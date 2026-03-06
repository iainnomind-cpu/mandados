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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: supabaseHeaders,
  });
  return res.json();
}

async function supabaseInsert(table: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify(data),
  });
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

async function supabaseUpdate(table: string, id: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: supabaseHeaders,
    body: JSON.stringify(data),
  });
  return res.json();
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
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function getChatGPTResponse(messages: ChatMessage[]): Promise<string> {
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
  // Look for JSON block in the response
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
  // Remove JSON code block from the message sent to the customer
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
// Main message processing logic
// ─────────────────────────────────────────────────────────
async function processIncomingMessage(from: string, messageText: string): Promise<void> {
  try {
    // 1. Find or create customer
    let customers = await supabaseGet('customers', `phone=eq.${from}&select=*`);
    let customer: any;

    if (customers.length === 0) {
      customer = await supabaseInsert('customers', {
        phone: from,
        name: null,
      });
      console.log('👤 Nuevo cliente creado:', customer.id);
    } else {
      customer = customers[0];
    }

    // 2. Find or create active conversation
    let conversations = await supabaseGet(
      'chat_conversations',
      `customer_id=eq.${customer.id}&status=eq.active&channel=eq.whatsapp&select=*&order=started_at.desc&limit=1`
    );
    let conversation: any;

    if (conversations.length === 0) {
      conversation = await supabaseInsert('chat_conversations', {
        customer_id: customer.id,
        channel: 'whatsapp',
        status: 'active',
      });
      console.log('💬 Nueva conversación creada:', conversation.id);
    } else {
      conversation = conversations[0];
    }

    // 3. Load message history for this conversation
    const dbMessages = await supabaseGet(
      'chat_messages',
      `conversation_id=eq.${conversation.id}&select=sender_type,message&order=created_at.asc&limit=20`
    );

    // 4. Build OpenAI messages array
    const openaiMessages: ChatMessage[] = [
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

    // 6. Get ChatGPT response
    const gptResponse = await getChatGPTResponse(openaiMessages);
    console.log('🤖 ChatGPT response:', gptResponse);

    // 7. Check if order is complete
    const orderData = extractOrderData(gptResponse);

    if (orderData) {
      // Create order in the database
      const orderNumber = generateOrderNumber();
      const order = await supabaseInsert('orders', {
        order_number: orderNumber,
        customer_id: customer.id,
        conversation_id: conversation.id,
        order_type: 'mandadito',
        source: 'chatbot',
        status: 'pending',
        priority: 'normal',
        pickup_address: { address: orderData.direccion_recoger },
        delivery_address: { address: orderData.direccion_entregar },
        pickup_contact: { name: orderData.nombre_cliente },
        delivery_contact: { name: orderData.nombre_cliente },
        items: [{ description: orderData.items }],
        payment_method: 'cash',
        payment_status: 'pending',
      });

      console.log('📦 Pedido creado:', orderNumber, order?.id);

      // Update customer name if we got it
      if (orderData.nombre_cliente && !customer.name) {
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
    }

    // 8. Save bot response to DB
    const cleanResponse = cleanResponseForWhatsApp(gptResponse);
    await supabaseInsert('chat_messages', {
      conversation_id: conversation.id,
      sender_type: 'bot',
      message: cleanResponse,
    });

    // 9. Send response via WhatsApp
    let finalMessage = cleanResponse;
    if (orderData) {
      finalMessage += `\n\n📋 *Número de pedido:* ${generateOrderNumber().replace(/WA-/, 'WA-')}`;
      finalMessage = cleanResponse; // Use the clean GPT response which already has the summary
    }

    await sendWhatsAppMessage(from, finalMessage);
    console.log('✅ Respuesta enviada a', from);

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    // Send a fallback message
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

    console.warn('⚠️ Verificación fallida: token inválido');
    return res.status(403).json({ error: 'Token de verificación inválido' });
  }

  // ─── POST: Incoming WhatsApp Messages ───
  if (req.method === 'POST') {
    const body = req.body;

    // Meta requires immediate 200 response
    // We process in the same request since Vercel supports up to 60s execution
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
                // Process text messages
                await processIncomingMessage(from, message.text.body);
              } else {
                // For non-text messages, send a friendly notice
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
