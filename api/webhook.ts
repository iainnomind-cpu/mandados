import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─────────────────────────────────────────────────────────
// Config & Constants
// ─────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID!;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;

const GRAPH_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;

const SYSTEM_PROMPT = `Eres un asistente virtual de "Mandados ERP", un servicio de mandados y entregas.
Tu trabajo es tomar pedidos de los clientes de forma amigable y eficiente.

Para completar un pedido necesitas recopilar estos 4 datos:
1. **Qué es el pedido** - qué artículos o cosas necesitan
2. **A nombre de quién** - nombre del cliente para el pedido
3. **Dónde recoger** - dirección o lugar de recolección
4. **Dónde entregar** - dirección o lugar de entrega

REGLAS:
- Sé amigable, usa emojis moderadamente y habla en español.
- Haz preguntas una por una para no abrumar al cliente.
- Si el cliente proporciona varios datos en un solo mensaje, acéptalos todos.
- Cuando tengas los 4 datos, confirma el resumen del pedido con el cliente.
- Cuando el cliente CONFIRME el pedido (diga "sí", "correcto", "confirmo", etc.), responde con el resumen final Y agrega al final de tu mensaje un bloque JSON con este formato exacto:

\`\`\`json
{"pedido_completo": true, "items": "descripción del pedido", "nombre_cliente": "nombre", "direccion_recoger": "dirección de recolección", "direccion_entregar": "dirección de entrega"}
\`\`\`

- NO incluyas el JSON hasta que el cliente haya CONFIRMADO explícitamente.
- Si el cliente quiere modificar algo antes de confirmar, acepta los cambios.
- Si el cliente saluda o hace preguntas generales, responde amablemente y guía la conversación hacia tomar su pedido.
- Mantén las respuestas cortas y claras (máximo 3-4 líneas).`;

// ─────────────────────────────────────────────────────────
// Supabase helpers (using fetch, no SDK needed)
// ─────────────────────────────────────────────────────────
const supabaseHeaders = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Prefer': 'return=representation',
};

async function supabaseGet(table: string, query: string): Promise<any[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  console.log('📡 Supabase GET:', url);
  const res = await fetch(url, { headers: supabaseHeaders });
  const body = await res.json();

  // PostgREST returns an array on success, or an object with error info
  if (!res.ok || !Array.isArray(body)) {
    console.error('⚠️ Supabase GET error:', JSON.stringify(body));
    return [];
  }
  return body;
}

async function supabaseInsert(table: string, data: Record<string, any>): Promise<any> {
  console.log('📡 Supabase INSERT:', table, JSON.stringify(data));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify(data),
  });
  const body = await res.json();

  if (!res.ok) {
    console.error('⚠️ Supabase INSERT error:', JSON.stringify(body));
    return null;
  }
  return Array.isArray(body) ? body[0] : body;
}

async function supabaseUpdate(table: string, id: string, data: Record<string, any>): Promise<any> {
  console.log('📡 Supabase UPDATE:', table, id, JSON.stringify(data));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: supabaseHeaders,
    body: JSON.stringify(data),
  });
  const body = await res.json();

  if (!res.ok) {
    console.error('⚠️ Supabase UPDATE error:', JSON.stringify(body));
  }
  return body;
}

// ─────────────────────────────────────────────────────────
// WhatsApp Cloud API helper
// ─────────────────────────────────────────────────────────
async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const res = await fetch(GRAPH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('❌ Error enviando mensaje WhatsApp:', error);
  }
}

// ─────────────────────────────────────────────────────────
// OpenAI Chat Completion
// ─────────────────────────────────────────────────────────
interface OAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function getChatGPTResponse(messages: OAIMessage[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('❌ Error OpenAI:', error);
    throw new Error(`OpenAI error: ${error}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─────────────────────────────────────────────────────────
// Order extraction from ChatGPT response
// ─────────────────────────────────────────────────────────
interface OrderData {
  pedido_completo: boolean;
  items: string;
  nombre_cliente: string;
  direccion_recoger: string;
  direccion_entregar: string;
}

function extractOrderData(response: string): OrderData | null {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;

  try {
    const data = JSON.parse(jsonMatch[1]);
    if (data.pedido_completo === true) {
      return data as OrderData;
    }
  } catch (e) {
    console.error('⚠️ Error parsing order JSON:', e);
  }
  return null;
}

function cleanResponseForWhatsApp(response: string): string {
  return response.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();
}

// ─────────────────────────────────────────────────────────
// Generate unique order number
// ─────────────────────────────────────────────────────────
function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WA-${date}-${rand}`;
}

// ─────────────────────────────────────────────────────────
// Format phone for display (e.g. 521234567890 → +52 1234567890)
// ─────────────────────────────────────────────────────────
function formatPhone(raw: string): string {
  if (raw.startsWith('52') && raw.length >= 12) {
    return `+52 ${raw.slice(2)}`;
  }
  return `+${raw}`;
}

// ─────────────────────────────────────────────────────────
// Main message processing logic
// ─────────────────────────────────────────────────────────
async function processIncomingMessage(from: string, messageText: string): Promise<void> {
  try {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📱 Procesando mensaje de ${from}: "${messageText}"`);

    // 1. Find or create customer by phone
    let customers = await supabaseGet('customers', `phone=eq.${encodeURIComponent(from)}&select=*`);
    let customer: any;

    if (customers.length === 0) {
      customer = await supabaseInsert('customers', {
        phone: from,
        name: null,
      });
      if (!customer) throw new Error('Failed to create customer');
      console.log('👤 Nuevo cliente creado:', customer.id);
    } else {
      customer = customers[0];
      console.log('👤 Cliente existente:', customer.id, customer.name);
    }

    // 2. Find active conversation for this customer on WhatsApp
    //    Use customer phone as the channel identifier so it shows in the UI
    const channelLabel = `whatsapp:${formatPhone(from)}`;

    let conversations = await supabaseGet(
      'chat_conversations',
      `customer_id=eq.${customer.id}&status=eq.active&select=*&order=started_at.desc&limit=1`
    );
    let conversation: any;

    if (conversations.length === 0) {
      conversation = await supabaseInsert('chat_conversations', {
        customer_id: customer.id,
        channel: channelLabel,
        status: 'active',
      });
      if (!conversation) throw new Error('Failed to create conversation');
      console.log('💬 Nueva conversación creada:', conversation.id);
    } else {
      conversation = conversations[0];
      // Update channel label if needed (in case old conversations used generic "whatsapp")
      if (conversation.channel !== channelLabel) {
        await supabaseUpdate('chat_conversations', conversation.id, { channel: channelLabel });
      }
      console.log('💬 Conversación existente:', conversation.id);
    }

    // 3. Load message history for this conversation (last 20 messages)
    const dbMessages = await supabaseGet(
      'chat_messages',
      `conversation_id=eq.${conversation.id}&select=sender_type,message&order=created_at.asc&limit=20`
    );
    console.log(`📜 Historial: ${dbMessages.length} mensajes previos`);

    // 4. Build OpenAI messages array
    const openaiMessages: OAIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    for (const msg of dbMessages) {
      openaiMessages.push({
        role: msg.sender_type === 'customer' ? 'user' : 'assistant',
        content: msg.message,
      });
    }

    // Add the current message
    openaiMessages.push({ role: 'user', content: messageText });

    // 5. Save user message to DB
    await supabaseInsert('chat_messages', {
      conversation_id: conversation.id,
      sender_type: 'customer',
      message: messageText,
    });

    // 5b. Check if bot is paused (operator has taken over)
    if (conversation.bot_paused === true) {
      console.log('⏸️ Bot pausado — mensaje guardado, sin respuesta automática');
      return; // Operator will respond manually from the panel
    }

    // 6. Get ChatGPT response
    const gptResponse = await getChatGPTResponse(openaiMessages);
    console.log('🤖 ChatGPT:', gptResponse);

    // 7. Check if order is complete
    const orderData = extractOrderData(gptResponse);
    let orderNumber: string | null = null;

    if (orderData) {
      console.log('📦 Datos del pedido extraídos:', JSON.stringify(orderData));

      orderNumber = generateOrderNumber();

      // Create order with ALL required fields properly mapped
      const order = await supabaseInsert('orders', {
        order_number: orderNumber,
        customer_id: customer.id,
        conversation_id: conversation.id,
        customer_name: orderData.nombre_cliente,
        customer_phone: from,
        order_type: 'mandadito',
        source: 'chatbot',
        status: 'pending',
        priority: 'normal',
        // Frontend expects { street, city } format
        pickup_address: {
          street: orderData.direccion_recoger,
          city: '',
        },
        delivery_address: {
          street: orderData.direccion_entregar,
          city: '',
        },
        pickup_contact: {
          name: orderData.nombre_cliente,
          phone: from,
        },
        delivery_contact: {
          name: orderData.nombre_cliente,
          phone: from,
        },
        items: [{ name: orderData.items, quantity: 1 }],
        special_instructions: `Pedido tomado por WhatsApp. Artículos: ${orderData.items}`,
        payment_method: 'cash',
        payment_status: 'pending',
      });

      if (order) {
        console.log('✅ Pedido creado:', orderNumber, order.id);

        // Update customer name if we got it
        if (orderData.nombre_cliente) {
          await supabaseUpdate('customers', customer.id, {
            name: orderData.nombre_cliente,
          });
        }

        // Close the conversation
        await supabaseUpdate('chat_conversations', conversation.id, {
          status: 'completed',
          ended_at: new Date().toISOString(),
        });

        // Create order event
        await supabaseInsert('order_events', {
          order_id: order.id,
          event_type: 'created',
          description: `Pedido creado vía WhatsApp. Número: ${orderNumber}`,
          metadata: { source: 'whatsapp', phone: from },
        });
      } else {
        console.error('❌ Error al crear el pedido en Supabase');
      }
    }

    // 8. Clean the response (remove JSON block) and save bot message
    const cleanResponse = cleanResponseForWhatsApp(gptResponse);
    await supabaseInsert('chat_messages', {
      conversation_id: conversation.id,
      sender_type: 'bot',
      message: cleanResponse,
    });

    // 9. Build final message and send via WhatsApp
    let finalMessage = cleanResponse;
    if (orderData && orderNumber) {
      finalMessage += `\n\n📋 *Número de pedido:* ${orderNumber}`;
    }

    await sendWhatsAppMessage(from, finalMessage);
    console.log('✅ Respuesta enviada a', from);

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    await sendWhatsAppMessage(
      from,
      '😅 Disculpa, tuve un problema técnico. ¿Podrías repetir tu mensaje?'
    );
  }
}

// ─────────────────────────────────────────────────────────
// Vercel Handler
// ─────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ─── GET: Meta Webhook Verification ───
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Token de verificación inválido' });
  }

  // ─── POST: Incoming WhatsApp Messages ───
  if (req.method === 'POST') {
    const body = req.body;

    if (body?.object === 'whatsapp_business_account') {
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field === 'messages') {
            const messages = change.value?.messages || [];

            for (const message of messages) {
              const from = message.from;
              const msgType = message.type;

              if (msgType === 'text' && message.text?.body) {
                await processIncomingMessage(from, message.text.body);
              } else {
                await sendWhatsAppMessage(
                  from,
                  '📝 Por ahora solo puedo leer mensajes de texto. ¿Podrías escribir tu pedido? 😊'
                );
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
