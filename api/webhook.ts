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

// ─────────────────────────────────────────────────────────
// Dynamic system prompt builder
// ─────────────────────────────────────────────────────────
interface CustomerContext {
  name: string | null;
  lastDeliveryAddress: string | null;
}

function buildSystemPrompt(ctx: CustomerContext): string {
  const isReturning = !!(ctx.name && ctx.lastDeliveryAddress);

  if (isReturning) {
    return `Eres un asistente virtual de "Mandados ERP", un servicio de mandados y entregas.
Tu ÚNICO trabajo es tomar pedidos.

DATOS DEL CLIENTE (ya guardados de pedidos anteriores):
- Nombre: ${ctx.name}
- Dirección de entrega habitual: ${ctx.lastDeliveryAddress}

FLUJO PARA CLIENTE RECURRENTE (sigue este flujo ESTRICTO):
PASO 1 → Saluda al cliente por su nombre (${ctx.name}) y pregunta: ¿Qué necesitas pedir hoy?
PASO 2 → Pregunta: ¿Dónde pasamos a recogerlo? (dirección de recolección)
PASO 3 → Pregunta: ¿Lo entregamos en tu dirección habitual (${ctx.lastDeliveryAddress}) o prefieres otra dirección?
PASO 4 → Mostrar resumen completo y preguntar: ¿Confirmas tu pedido?
PASO 5 (CONFIRMACIÓN) → Cuando el cliente CONFIRME (diga "sí", "correcto", "confirmo", "ok", "dale", etc.), responde SOLAMENTE con un mensaje corto como "¡Perfecto! Tu pedido ha sido registrado 🎉" y OBLIGATORIAMENTE agrega al final este bloque JSON con los datos reales del pedido:

\`\`\`json
{"pedido_completo": true, "items": "descripción del pedido", "nombre_cliente": "${ctx.name}", "direccion_recoger": "dirección de recolección", "direccion_entregar": "dirección de entrega"}
\`\`\`

REGLAS ESTRICTAS:
- YA TIENES el nombre del cliente, NO lo preguntes de nuevo.
- Si el cliente dice "sí", "la misma", "ahí mismo", etc. para la dirección de entrega, usa la dirección habitual guardada.
- Si el cliente quiere cambiar la dirección de entrega, acéptala y usa la nueva.
- Si el cliente da varios datos en un mensaje, acéptalos pero SIEMPRE pregunta por los que falten.
- NUNCA asumas datos que el cliente no ha proporcionado explícitamente (excepto nombre y dirección habitual que ya tienes).
- NUNCA preguntes "¿Necesitas algo más?" HASTA que hayas completado todos los pasos.
- Cuando tengas un pedido anterior en el historial marcado con [PEDIDO COMPLETADO], IGNORA esos datos — son de un pedido anterior. Empieza un nuevo flujo desde PASO 1.
- Sé amigable, usa emojis moderadamente y habla en español.
- Mantén las respuestas cortas (1-2 líneas por mensaje).

PROHIBIDO:
- NUNCA repitas el resumen después de que el cliente ya confirmó. Si el cliente dice "sí" o "confirmo" después del resumen, ve DIRECTO al PASO 5 (genera el JSON).
- NO incluyas el JSON hasta que el cliente haya CONFIRMADO en el PASO 5.
- NUNCA omitas el bloque JSON cuando el cliente confirma. El JSON es OBLIGATORIO en la confirmación.

- Si el cliente saluda, responde brevemente usando su nombre y pregunta qué necesita pedir (PASO 1).`;
  }

  // New customer — full flow
  return `Eres un asistente virtual de "Mandados ERP", un servicio de mandados y entregas.
Tu ÚNICO trabajo es tomar pedidos. Sigue este flujo ESTRICTO:

FLUJO OBLIGATORIO (no saltes ningún paso):
PASO 1 → Preguntar: ¿Qué necesitas pedir? (artículos/productos)
PASO 2 → Preguntar: ¿A nombre de quién es el pedido?
PASO 3 → Preguntar: ¿Dónde pasamos a recogerlo? (dirección de recolección)
PASO 4 → Preguntar: ¿Dónde lo entregamos? (dirección de entrega)
PASO 5 → Mostrar resumen completo y preguntar: ¿Confirmas tu pedido?
PASO 6 (CONFIRMACIÓN) → Cuando el cliente CONFIRME (diga "sí", "correcto", "confirmo", "ok", "dale", etc.), responde SOLAMENTE con un mensaje corto como "¡Perfecto! Tu pedido ha sido registrado 🎉" y OBLIGATORIAMENTE agrega al final este bloque JSON con los datos reales del pedido:

\`\`\`json
{"pedido_completo": true, "items": "descripción del pedido", "nombre_cliente": "nombre", "direccion_recoger": "dirección de recolección", "direccion_entregar": "dirección de entrega"}
\`\`\`

REGLAS ESTRICTAS:
- SIEMPRE sigue el flujo paso a paso. Si ya tienes un dato, pasa al siguiente paso que te falte.
- Si el cliente da varios datos en un mensaje, acéptalos pero SIEMPRE pregunta por los que falten.
- NUNCA asumas datos que el cliente no ha proporcionado explícitamente.
- NUNCA preguntes "¿Necesitas algo más?" o "¿Puedo ayudarte en algo más?" HASTA que hayas completado los 6 pasos.
- Cuando tengas un pedido anterior en el historial marcado con [PEDIDO COMPLETADO], IGNORA esos datos — son de un pedido anterior. Empieza un nuevo flujo desde PASO 1.
- Sé amigable, usa emojis moderadamente y habla en español.
- Mantén las respuestas cortas (1-2 líneas por mensaje, solo la pregunta del paso actual).

PROHIBIDO:
- NUNCA repitas el resumen después de que el cliente ya confirmó. Si el cliente dice "sí" o "confirmo" después del resumen, ve DIRECTO al PASO 6 (genera el JSON).
- NO incluyas el JSON hasta que el cliente haya CONFIRMADO en el PASO 6.
- NUNCA omitas el bloque JSON cuando el cliente confirma. El JSON es OBLIGATORIO en la confirmación.

- Si el cliente saluda, responde brevemente y pregunta qué necesita pedir (PASO 1).`;
}

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
// WhatsApp Media download helper
// ─────────────────────────────────────────────────────────
async function downloadWhatsAppMedia(mediaId: string): Promise<string | null> {
  try {
    // Step 1: Get the media URL from WhatsApp
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
    });

    if (!metaRes.ok) {
      console.error('❌ Error getting media metadata:', await metaRes.text());
      return null;
    }

    const metaData = await metaRes.json();
    const mediaUrl = metaData.url;

    if (!mediaUrl) {
      console.error('❌ No URL in media metadata');
      return null;
    }

    // Step 2: Download the actual image binary
    const imgRes = await fetch(mediaUrl, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
    });

    if (!imgRes.ok) {
      console.error('❌ Error downloading media:', imgRes.status);
      return null;
    }

    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = metaData.mime_type || 'image/jpeg';

    console.log(`📸 Imagen descargada: ${(buffer.byteLength / 1024).toFixed(1)} KB, tipo: ${mimeType}`);
    return `data:${mimeType};base64,${base64}`;
  } catch (e) {
    console.error('❌ Error descargando media:', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// OpenAI Chat Completion (supports text + vision)
// ─────────────────────────────────────────────────────────
type OAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' } };

interface OAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OAIContentPart[];
}

async function getChatGPTResponse(messages: OAIMessage[], useVision: boolean = false): Promise<string> {
  const model = useVision ? 'gpt-4o' : 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
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
// Clean phone for database (remove 521 or 52 prefix to keep 10 digits)
// ─────────────────────────────────────────────────────────
function cleanPhone(raw: string): string {
  // Mexican WhatsApp numbers often come as 521 + 10 digits
  if (raw.startsWith('521') && raw.length === 13) {
    return raw.slice(3);
  }
  // Standard Mexican code 52 + 10 digits
  if (raw.startsWith('52') && raw.length === 12) {
    return raw.slice(2);
  }
  return raw;
}

// ─────────────────────────────────────────────────────────
// Format phone for display (e.g. 1234567890 → +52 1234567890)
// ─────────────────────────────────────────────────────────
function formatPhone(raw: string): string {
  // If it's already 10 digits, prepend +52
  if (raw.length === 10) {
    return `+52 ${raw}`;
  }
  // Fallback for raw WhatsApp IDs
  if (raw.startsWith('52') && raw.length >= 12) {
    return `+52 ${raw.slice(raw.startsWith('521') ? 3 : 2)}`;
  }
  return `+${raw}`;
}

// ─────────────────────────────────────────────────────────
// Fetch customer context (name + last delivery address)
// ─────────────────────────────────────────────────────────
async function getCustomerContext(customerId: string, customer: any): Promise<CustomerContext> {
  const ctx: CustomerContext = {
    name: customer.name || null,
    lastDeliveryAddress: null,
  };

  // Try to get address from customer.addresses first
  if (customer.addresses && Array.isArray(customer.addresses) && customer.addresses.length > 0) {
    const lastAddr = customer.addresses[customer.addresses.length - 1];
    ctx.lastDeliveryAddress = typeof lastAddr === 'string'
      ? lastAddr
      : lastAddr.street || lastAddr.address || JSON.stringify(lastAddr);
  }

  // Fallback: check the last completed order's delivery address
  if (!ctx.lastDeliveryAddress) {
    const lastOrders = await supabaseGet(
      'orders',
      `customer_id=eq.${customerId}&status=eq.delivered&select=delivery_address,customer_name&order=created_at.desc&limit=1`
    );

    if (lastOrders.length > 0) {
      const addr = lastOrders[0].delivery_address;
      if (addr) {
        ctx.lastDeliveryAddress = typeof addr === 'string'
          ? addr
          : addr.street || addr.address || JSON.stringify(addr);
      }
      // Also get name from last order if we don't have it
      if (!ctx.name && lastOrders[0].customer_name) {
        ctx.name = lastOrders[0].customer_name;
      }
    }
  }

  // Also check pending/confirmed/assigned/in_transit orders (not just delivered)
  if (!ctx.lastDeliveryAddress) {
    const recentOrders = await supabaseGet(
      'orders',
      `customer_id=eq.${customerId}&select=delivery_address,customer_name&order=created_at.desc&limit=1`
    );

    if (recentOrders.length > 0) {
      const addr = recentOrders[0].delivery_address;
      if (addr) {
        ctx.lastDeliveryAddress = typeof addr === 'string'
          ? addr
          : addr.street || addr.address || JSON.stringify(addr);
      }
      if (!ctx.name && recentOrders[0].customer_name) {
        ctx.name = recentOrders[0].customer_name;
      }
    }
  }

  return ctx;
}

// ─────────────────────────────────────────────────────────
// Save delivery address to customer profile
// ─────────────────────────────────────────────────────────
async function saveDeliveryAddress(customerId: string, address: string): Promise<void> {
  try {
    // Fetch current addresses
    const customers = await supabaseGet('customers', `id=eq.${customerId}&select=addresses`);
    if (customers.length === 0) return;

    let addresses: string[] = [];
    if (customers[0].addresses && Array.isArray(customers[0].addresses)) {
      addresses = customers[0].addresses.map((a: any) =>
        typeof a === 'string' ? a : a.street || a.address || ''
      ).filter(Boolean);
    }

    // Don't duplicate — check if this address (or similar) is already stored
    const normalized = address.toLowerCase().trim();
    const alreadyExists = addresses.some(
      (a) => a.toLowerCase().trim() === normalized
    );

    if (!alreadyExists) {
      addresses.push(address);
      // Keep only the last 5 addresses
      if (addresses.length > 5) addresses = addresses.slice(-5);
    }

    await supabaseUpdate('customers', customerId, { addresses });
    console.log('💾 Dirección guardada en perfil del cliente');
  } catch (e) {
    console.error('⚠️ Error guardando dirección:', e);
  }
}

// ─────────────────────────────────────────────────────────
// Analyze image with GPT-4o Vision
// ─────────────────────────────────────────────────────────
async function analyzeImageWithVision(imageDataUrl: string, caption?: string): Promise<string> {
  const userContent: OAIContentPart[] = [
    {
      type: 'image_url',
      image_url: { url: imageDataUrl, detail: 'low' },
    },
    {
      type: 'text',
      text: caption
        ? `El cliente envió esta imagen con el texto: "${caption}". Identifica los productos o artículos que se ven en la imagen para un pedido de mandados. Lista solo los productos de forma clara y concisa.`
        : 'El cliente envió esta imagen. Identifica los productos o artículos que se ven en la imagen para un pedido de mandados. Si es una lista escrita a mano, transcríbela. Si son productos (leche, refresco, etc.), descríbelos. Lista solo los productos de forma clara y concisa.',
    },
  ];

  const messages: OAIMessage[] = [
    {
      role: 'system',
      content: 'Eres un asistente que identifica productos en imágenes para un servicio de mandados. Responde SOLO con la lista de productos identificados, sin explicaciones extra. Si no puedes identificar productos, di "No pude identificar productos claros en la imagen".',
    },
    {
      role: 'user',
      content: userContent,
    },
  ];

  return getChatGPTResponse(messages, true);
}

// ─────────────────────────────────────────────────────────
// Main message processing logic
// ─────────────────────────────────────────────────────────
async function processIncomingMessage(
  from: string, // The original WhatsApp ID for replying
  messageText: string,
  imageDataUrl?: string | null
): Promise<void> {
  try {
    const customerPhone = cleanPhone(from); // 10 digit number for DB

    console.log(`\n${'='.repeat(50)}`);
    console.log(`📱 Procesando mensaje de ${customerPhone} (raw: ${from}): "${messageText || '[imagen]'}"`);

    // 1. Find or create customer by phone (using cleaned 10-digit number)
    let customers = await supabaseGet('customers', `phone=eq.${encodeURIComponent(customerPhone)}&select=*`);
    let customer: any;

    if (customers.length === 0) {
      customer = await supabaseInsert('customers', {
        phone: customerPhone,
        name: null,
      });
      if (!customer) throw new Error('Failed to create customer');
      console.log('👤 Nuevo cliente creado:', customer.id);
    } else {
      customer = customers[0];
      console.log('👤 Cliente existente:', customer.id, customer.name);
    }

    // 2. Find active conversation for this customer on WhatsApp
    const channelLabel = `whatsapp:${formatPhone(customerPhone)}`;

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
      if (conversation.channel !== channelLabel) {
        await supabaseUpdate('chat_conversations', conversation.id, { channel: channelLabel });
      }
      console.log('💬 Conversación existente:', conversation.id);
    }

    // 3. If image, analyze it with Vision first
    let effectiveMessageText = messageText;

    if (imageDataUrl) {
      console.log('📸 Analizando imagen con GPT-4o Vision...');
      const imageAnalysis = await analyzeImageWithVision(imageDataUrl, messageText || undefined);
      console.log('📸 Productos identificados:', imageAnalysis);

      // Combine image analysis with any caption text
      effectiveMessageText = messageText
        ? `${messageText}\n\n[El cliente también envió una imagen. Productos identificados en la imagen: ${imageAnalysis}]`
        : `[El cliente envió una imagen con productos. Productos identificados: ${imageAnalysis}]`;
    }

    // 4. Get customer context (name, last address) for smart prompt
    const customerCtx = await getCustomerContext(customer.id, customer);
    console.log('🧠 Contexto del cliente:', JSON.stringify(customerCtx));

    const systemPrompt = buildSystemPrompt(customerCtx);

    // 5. Load message history for this conversation (last 20 messages)
    const dbMessages = await supabaseGet(
      'chat_messages',
      `conversation_id=eq.${conversation.id}&select=sender_type,message&order=created_at.asc&limit=20`
    );
    console.log(`📜 Historial: ${dbMessages.length} mensajes previos`);

    // 6. Build OpenAI messages array
    const openaiMessages: OAIMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of dbMessages) {
      openaiMessages.push({
        role: msg.sender_type === 'customer' ? 'user' : 'assistant',
        content: msg.message,
      });
    }

    // Add the current message
    openaiMessages.push({ role: 'user', content: effectiveMessageText });

    // 7. Save user message to DB
    await supabaseInsert('chat_messages', {
      conversation_id: conversation.id,
      sender_type: 'customer',
      message: effectiveMessageText,
    });

    // 7b. Check global bot pause
    const settings = await supabaseGet('system_settings', 'id=eq.1&select=bot_paused_globally');
    const isGloballyPaused = settings.length > 0 && settings[0].bot_paused_globally === true;

    if (isGloballyPaused) {
      console.log('🛑 Bot pausado GLOBALMENTE — mensaje guardado, sin respuesta automática');
      return;
    }

    // 7c. Check individual conversation bot pause (operator has taken over)
    if (conversation.bot_paused === true) {
      console.log('⏸️ Bot pausado en esta conversación — mensaje guardado, sin respuesta automática');
      return;
    }

    // 8. Get ChatGPT response
    const gptResponse = await getChatGPTResponse(openaiMessages);
    console.log('🤖 ChatGPT:', gptResponse);

    // 9. Check if order is complete
    const orderData = extractOrderData(gptResponse);
    let orderNumber: string | null = null;

    if (orderData) {
      console.log('📦 Datos del pedido extraídos:', JSON.stringify(orderData));

      orderNumber = generateOrderNumber();

      const order = await supabaseInsert('orders', {
        order_number: orderNumber,
        customer_id: customer.id,
        conversation_id: conversation.id,
        customer_name: orderData.nombre_cliente,
        customer_phone: customerPhone,
        order_type: 'mandadito',
        source: 'chatbot',
        status: 'pending',
        priority: 'normal',
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
          phone: customerPhone,
        },
        delivery_contact: {
          name: orderData.nombre_cliente,
          phone: customerPhone,
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

        // Save delivery address for future orders
        if (orderData.direccion_entregar) {
          await saveDeliveryAddress(customer.id, orderData.direccion_entregar);
        }

        // Create order event
        await supabaseInsert('order_events', {
          order_id: order.id,
          event_type: 'created',
          description: `Pedido creado vía WhatsApp. Número: ${orderNumber}`,
          metadata: { source: 'whatsapp', phone: customerPhone },
        });

        // Insert a reset marker so ChatGPT knows to start a new order flow
        await supabaseInsert('chat_messages', {
          conversation_id: conversation.id,
          sender_type: 'bot',
          message: `[PEDIDO COMPLETADO] Pedido ${orderNumber} creado exitosamente. --- Nuevo flujo de pedido disponible ---`,
        });
      } else {
        console.error('❌ Error al crear el pedido en Supabase');
      }
    }

    // 10. Clean the response (remove JSON block) and save bot message
    const cleanResponse = cleanResponseForWhatsApp(gptResponse);
    await supabaseInsert('chat_messages', {
      conversation_id: conversation.id,
      sender_type: 'bot',
      message: cleanResponse,
    });

    // 11. Build final message and send via WhatsApp
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
                // Text message — process normally
                await processIncomingMessage(from, message.text.body);

              } else if (msgType === 'image') {
                // Image message — download and analyze with Vision
                const mediaId = message.image?.id;
                const caption = message.image?.caption || '';

                if (mediaId) {
                  console.log(`📸 Imagen recibida de ${from}, media_id: ${mediaId}`);
                  const imageDataUrl = await downloadWhatsAppMedia(mediaId);

                  if (imageDataUrl) {
                    await processIncomingMessage(from, caption, imageDataUrl);
                  } else {
                    await sendWhatsAppMessage(
                      from,
                      '😅 No pude procesar la imagen. ¿Podrías enviarla de nuevo o escribir tu pedido? 📝'
                    );
                  }
                } else {
                  await sendWhatsAppMessage(
                    from,
                    '😅 No pude recibir la imagen correctamente. ¿Podrías enviarla de nuevo? 📷'
                  );
                }

              } else {
                // Unsupported message types (audio, video, sticker, etc.)
                await sendWhatsAppMessage(
                  from,
                  '📝 Por ahora puedo leer mensajes de texto e imágenes. ¿Podrías escribir tu pedido o enviar una foto? 😊'
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
