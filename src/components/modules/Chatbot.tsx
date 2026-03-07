import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, MessageCircle, User, Search, Phone, Pause, Play,
  Clock, CheckCircle, AlertCircle, Filter, UserCheck, Info, X,
  Package, MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ChatMessage, ChatConversation } from '../../types';

// ─── Status config ───
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  active: { label: 'Activa', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: Clock },
  completed: { label: 'Completada', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: CheckCircle },
  abandoned: { label: 'Abandonada', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertCircle },
};

// ─── Helpers ───
function extractPhoneFromChannel(channel: string): string {
  if (channel.startsWith('whatsapp:')) return channel.replace('whatsapp:', '');
  return channel;
}

function extractRawPhone(channel: string): string {
  // Extract raw digits for sending messages: "whatsapp:+52 1443213..." → "521443213..."
  return channel.replace('whatsapp:', '').replace(/[+\s]/g, '');
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function Chatbot() {
  // ─── State ───
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [togglingBot, setTogglingBot] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Derived ───
  const selectedConv = conversations.find((c) => c.id === selectedId) || null;
  const isBotPaused = selectedConv?.bot_paused ?? false;

  // ─── Load conversations ───
  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*, customers:customer_id(name, phone)')
      .order('started_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      const mapped: ChatConversation[] = data.map((c: any) => ({
        ...c,
        customer_name: c.customers?.name || null,
        customer_phone: c.customers?.phone || extractPhoneFromChannel(c.channel),
      }));
      setConversations(mapped);
      if (mapped.length > 0 && !selectedId) {
        setSelectedId(mapped[0].id);
      }
    }
  }, [selectedId]);

  useEffect(() => { loadConversations(); }, []);

  // ─── Real-time conversation list ───
  // ─── Real-time conversation list (direct subscription + polling) ───
  const loadConvRef = useRef(loadConversations);
  loadConvRef.current = loadConversations;

  useEffect(() => {
    // Polling fallback for conversations (every 5s)
    const interval = setInterval(() => { loadConvRef.current(); }, 5000);

    // Supabase realtime channel
    const channel = supabase
      .channel('chat-conv-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, () => {
        loadConvRef.current();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        loadConvRef.current();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // ─── Load messages ───
  const loadMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
      loadConversationInfo(selectedId);
    }
  }, [selectedId, loadMessages]);

  // ─── Real-time messages (direct subscription + polling) ───
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    if (!selectedId) return;

    // Polling fallback (every 3s for the active chat)
    const interval = setInterval(() => {
      if (selectedIdRef.current) {
        loadMessagesRef.current(selectedIdRef.current);
      }
    }, 3000);

    // Supabase realtime channel for this conversation
    const channel = supabase
      .channel(`chat-msgs-${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, () => {
        loadMessagesRef.current(selectedId);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // ─── Auto-scroll ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Load customer + order info for side panel ───
  const loadConversationInfo = async (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv?.customer_id) {
      setCustomerInfo(null);
      setOrderInfo(null);
      return;
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', conv.customer_id)
      .single();
    setCustomerInfo(customer);

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('conversation_id', convId)
      .limit(1)
      .maybeSingle();
    setOrderInfo(order);
  };

  // ─── Toggle bot pause ───
  const toggleBotPause = async () => {
    if (!selectedId) return;
    setTogglingBot(true);
    const newValue = !isBotPaused;

    await supabase
      .from('chat_conversations')
      .update({ bot_paused: newValue })
      .eq('id', selectedId);

    // Update local state
    setConversations((prev) =>
      prev.map((c) => c.id === selectedId ? { ...c, bot_paused: newValue } : c)
    );
    setTogglingBot(false);
  };

  // ─── Send operator message (also to WhatsApp) ───
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedId || !selectedConv) return;

    setLoading(true);
    try {
      // 1. Save to DB
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          conversation_id: selectedId,
          sender_type: 'operator',
          message: newMessage,
          metadata: {},
        }]);

      if (!error) {
        // 2. Send to WhatsApp if conversation is a WhatsApp channel
        if (selectedConv.channel.startsWith('whatsapp:')) {
          const rawPhone = extractRawPhone(selectedConv.channel);
          try {
            await fetch('/api/whatsapp-send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: rawPhone, message: newMessage }),
            });
          } catch (e) {
            console.error('Error sending to WhatsApp:', e);
          }
        }

        setNewMessage('');
        loadMessages(selectedId);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Filter conversations ───
  const filtered = conversations.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (c.customer_name || '').toLowerCase();
      const phone = (c.customer_phone || c.channel).toLowerCase();
      return name.includes(q) || phone.includes(q);
    }
    return true;
  });

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen bg-slate-100">
      {/* ══════════ LEFT PANEL: Conversations ══════════ */}
      <div className="w-[340px] bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">Chat / IA</h2>
            </div>
            <span className="text-xs font-medium text-blue-100 bg-white/20 px-2.5 py-1 rounded-full">
              {conversations.filter((c) => c.status === 'active').length} activas
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-200" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full pl-10 pr-4 py-2 bg-white/15 backdrop-blur text-white placeholder-blue-200 text-sm rounded-lg border border-white/20 focus:outline-none focus:bg-white/25 transition-colors"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50">
          {[
            { key: 'all', label: 'Todas' },
            { key: 'active', label: 'Activas' },
            { key: 'completed', label: 'Cerradas' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${statusFilter === key
                ? 'bg-white text-blue-700 shadow-sm border border-blue-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Filter className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Sin conversaciones</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const isSelected = selectedId === conv.id;
              const displayName = conv.customer_name || extractPhoneFromChannel(conv.channel);
              const displayPhone = conv.customer_phone || extractPhoneFromChannel(conv.channel);
              const statusCfg = STATUS_CONFIG[conv.status] || STATUS_CONFIG.active;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`px-4 py-3.5 cursor-pointer border-b border-slate-50 transition-all ${isSelected
                    ? 'bg-blue-50 border-l-[3px] border-l-blue-600'
                    : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${conv.status === 'active'
                      ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                      : 'bg-slate-200'
                      }`}>
                      <User className={`w-5 h-5 ${conv.status === 'active' ? 'text-white' : 'text-slate-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                          {timeAgo(conv.started_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-400 truncate">{displayPhone}</span>
                      </div>

                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
                          {conv.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {statusCfg.label}
                        </span>

                        {conv.bot_paused && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Pause className="w-2.5 h-2.5" /> Bot pausado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════ CENTER PANEL: Chat ══════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedConv.status === 'active'
                  ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                  : 'bg-slate-200'
                  }`}>
                  <User className={`w-5 h-5 ${selectedConv.status === 'active' ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {selectedConv.customer_name || extractPhoneFromChannel(selectedConv.channel)}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {selectedConv.customer_phone || extractPhoneFromChannel(selectedConv.channel)}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_CONFIG[selectedConv.status]?.bg} ${STATUS_CONFIG[selectedConv.status]?.color}`}>
                      {STATUS_CONFIG[selectedConv.status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Bot Pause/Resume */}
                {selectedConv.status === 'active' && (
                  <button
                    onClick={toggleBotPause}
                    disabled={togglingBot}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${isBotPaused
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      }`}
                    title={isBotPaused ? 'Reanudar el bot automático' : 'Pausar el bot y responder manualmente'}
                  >
                    {isBotPaused ? (
                      <><Play className="w-3.5 h-3.5" /> Reanudar Bot</>
                    ) : (
                      <><Pause className="w-3.5 h-3.5" /> Pausar Bot</>
                    )}
                  </button>
                )}

                {/* Info panel toggle */}
                <button
                  onClick={() => setShowInfoPanel(!showInfoPanel)}
                  className={`p-2 rounded-lg border transition-all ${showInfoPanel
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600'
                    }`}
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bot paused banner */}
            {isBotPaused && (
              <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">
                  Bot pausado · Estás respondiendo manualmente. Los mensajes se enviarán directamente al cliente por WhatsApp.
                </span>
              </div>
            )}

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e2e8f0\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#f8fafc' }}
            >
              {/* Date separator */}
              {messages.length > 0 && (
                <div className="flex items-center justify-center my-2">
                  <span className="text-[10px] font-medium text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                    {new Date(messages[0].created_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
              )}

              {messages.map((msg) => {
                const isOutgoing = msg.sender_type === 'bot' || msg.sender_type === 'operator';
                const senderLabel = msg.sender_type === 'bot' ? '🤖 Bot' : msg.sender_type === 'operator' ? '🎧 Operador' : null;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] relative group ${isOutgoing ? 'order-1' : ''}`}>
                      {/* Sender label */}
                      {senderLabel && (
                        <p className={`text-[10px] font-semibold mb-0.5 ${msg.sender_type === 'bot' ? 'text-blue-500 text-right' : 'text-indigo-500 text-right'
                          }`}>
                          {senderLabel}
                        </p>
                      )}

                      <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${msg.sender_type === 'customer'
                        ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                        : msg.sender_type === 'bot'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md'
                          : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-md'
                        }`}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${msg.sender_type === 'customer' ? 'text-slate-400' : 'text-white/70'
                          } ${isOutgoing ? 'text-right' : ''}`}>
                          {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-5 py-3 bg-white border-t border-slate-200">
              {selectedConv.status === 'active' ? (
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={isBotPaused ? 'Escribe tu respuesta al cliente...' : 'Escribe un mensaje como operador...'}
                    className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !newMessage.trim()}
                    className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center py-2 text-slate-400 text-sm gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Esta conversación ha sido cerrada
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-400 mb-1">Chat / IA</h3>
              <p className="text-sm text-slate-400">Selecciona una conversación para comenzar</p>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ RIGHT PANEL: Info ══════════ */}
      {showInfoPanel && selectedConv && (
        <div className="w-[300px] bg-white border-l border-slate-200 flex flex-col shrink-0">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-700">Información</h4>
            <button
              onClick={() => setShowInfoPanel(false)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Customer info */}
            <div>
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Cliente</h5>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">
                      {customerInfo?.name || selectedConv.customer_name || 'Sin nombre'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {customerInfo?.phone || selectedConv.customer_phone || extractPhoneFromChannel(selectedConv.channel)}
                    </p>
                  </div>
                </div>

                {customerInfo?.email && (
                  <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    📧 {customerInfo.email}
                  </div>
                )}
              </div>
            </div>

            {/* Conversation info */}
            <div>
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Conversación</h5>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Canal</span>
                  <span className="font-medium text-slate-600 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> WhatsApp
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Estado</span>
                  <span className={`font-medium ${STATUS_CONFIG[selectedConv.status]?.color}`}>
                    {STATUS_CONFIG[selectedConv.status]?.label}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Bot</span>
                  <span className={`font-medium ${isBotPaused ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {isBotPaused ? '⏸ Pausado' : '▶ Activo'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Inicio</span>
                  <span className="font-medium text-slate-600">
                    {new Date(selectedConv.started_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Mensajes</span>
                  <span className="font-medium text-slate-600">{messages.length}</span>
                </div>
              </div>
            </div>

            {/* Order info */}
            {orderInfo && (
              <div>
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Pedido Vinculado</h5>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800">{orderInfo.order_number}</span>
                    <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      {orderInfo.status}
                    </span>
                  </div>

                  {orderInfo.pickup_address?.street && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-600">
                      <MapPin className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Recoger: {orderInfo.pickup_address.street}</span>
                    </div>
                  )}

                  {orderInfo.delivery_address?.street && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-600">
                      <MapPin className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                      <span>Entregar: {orderInfo.delivery_address.street}</span>
                    </div>
                  )}

                  {orderInfo.special_instructions && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-600">
                      <Package className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      <span>{orderInfo.special_instructions}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
