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

  const commonOrderTypes = `
TIPOS DE PEDIDO QUE MANEJAS:
1. **ENVÍO/ENTREGA** → El cliente quiere que recojas algo en un punto A y lo lleves a un punto B.
   - Ejemplo: "Recoge en Pizza Pomodori y lleva a Vigía 39"
   - Ejemplo: "Solicito un envío, recoger en Calle 19 y llevar a Hacienda San Miguel 13"
2. **COMPRA + ENTREGA** → El cliente quiere que COMPRES productos (tianguis, mercado, tienda) y los lleves a su dirección.
   - Ejemplo: "Necesito una compra del tianguis: Serrano 5kg, Morrón 2kg... llevarla a Ocampo 31"
3. **TICKET/NOTA DE RESTAURANTE** → El cliente envía foto de un ticket que ya tiene: productos, dirección de entrega, nombre del cliente, teléfono, total.
   - En estos casos la dirección del NEGOCIO en el ticket es la dirección de RECOLECCIÓN y la dirección del CLIENTE en el ticket es la de ENTREGA.`;

  const commonRules = `
DATOS NECESARIOS PARA COMPLETAR UN PEDIDO:
- items: ¿Qué se pide? (productos, artículos, comida)
- nombre_cliente: ¿A nombre de quién?
- direccion_recoger: ¿Dónde se recoge? (tienda, restaurante, dirección)
- direccion_entregar: ¿Dónde se entrega?

FLUJO ADAPTATIVO (INTELIGENTE):
- Analiza TODA la información que el cliente proporciona en su mensaje (texto o datos extraídos de una imagen).
- Identifica cuáles de los 4 datos ya tienes y cuáles faltan.
- Si el cliente proporcionó TODOS los datos de golpe, ve DIRECTO al resumen y confirmación.
- Si faltan datos, pregunta SOLO por el dato que falta — UNO a la vez, en este orden de prioridad:
  1. Items/productos (si no los tienes)
  2. Nombre del cliente (si no lo tienes)
  3. Dirección de recolección (si no la tienes)
  4. Dirección de entrega (si no la tienes)
- Cuando tengas TODOS los datos → Muestra resumen completo y pregunta: ¿Confirmas tu pedido?

CONFIRMACIÓN → Cuando el cliente CONFIRME (diga "sí", "correcto", "confirmo", "ok", "dale", etc.), responde SOLAMENTE con un mensaje corto como "¡Perfecto! Tu pedido ha sido registrado 🎉" y OBLIGATORIAMENTE agrega al final este bloque JSON:

\`\`\`json
{"pedido_completo": true, "items": "descripción completa del pedido", "nombre_cliente": "nombre", "direccion_recoger": "dirección de recolección", "direccion_entregar": "dirección de entrega"}
\`\`\`

MANEJO DE IMÁGENES Y TICKETS:
- Si el mensaje contiene "[DATOS EXTRAÍDOS DE IMAGEN]" seguido de información estructurada, significa que el cliente envió una FOTO y el sistema ya extrajo los datos automáticamente.
- Los datos extraídos pueden incluir: productos, direcciones, nombre del cliente, teléfono, monto total, nombre del negocio.
- ACEPTA todos los datos extraídos como válidos. NO pidas re-confirmar cada dato individualmente.
- Si los datos extraídos ya incluyen TODO lo necesario (items + nombre + dirección recolección + dirección entrega), ve DIRECTO al resumen y confirmación.
- Si faltan datos, pregunta SOLO por lo que falta.
- Si el sistema indica "DUDAS" o datos poco claros, pregunta específicamente sobre ESA duda.
- En tickets de restaurante: la dirección/nombre del negocio = dirección de RECOLECCIÓN. La dirección del cliente en el ticket = dirección de ENTREGA.

MANEJO DE TEXTO CON DATOS COMPLETOS:
- Si el cliente envía un mensaje de texto largo que ya incluye toda la info (ejemplo: "Solicito un envío, recoger en X y llevar a Y, recibe Lupita, pagar $790"), extrae TODOS los datos del mensaje.
- Si ya tienes todo, ve directo al resumen.
- El nombre de quien "recibe" es el nombre_cliente.
- Si mencionan un monto a pagar/cobrar, inclúyelo en el resumen.

REGLAS ESTRICTAS:
- Si ya tienes un dato, NO lo vuelvas a preguntar.
- Si el cliente da varios datos en un solo mensaje, acéptalos TODOS.
- NUNCA preguntes "¿Necesitas algo más?" hasta tener los 4 datos y haber confirmado.
- NUNCA agregues pasos extra de confirmación. Solo hay UNA confirmación: la del resumen final.
- Cuando tengas un pedido anterior en el historial marcado con [PEDIDO COMPLETADO], IGNORA esos datos — son de un pedido anterior.
- Sé amigable, usa emojis moderadamente y habla en español.
- Mantén las respuestas cortas (1-3 líneas por mensaje).
- Si algo no se entiende bien (dirección incompleta, producto confuso), pregunta específicamente sobre esa duda.

PROHIBIDO:
- NUNCA repitas el resumen después de que el cliente ya confirmó. Si dice "sí", genera el JSON de inmediato.
- NUNCA pidas confirmar los productos por separado. Solo UNA confirmación final.
- NO incluyas el JSON hasta que el cliente haya CONFIRMADO.
- NUNCA omitas el bloque JSON cuando el cliente confirma. Es OBLIGATORIO.

ESCALAMIENTO A HUMANO:
Si el mensaje del cliente NO es un pedido nuevo sino una situación especial que requiere atención humana, debes ESCALAR. Situaciones que requieren escalamiento:
- Problemas con un pedido ya entregado (producto dañado, equivocado, incompleto)
- Problemas de pago (doble cobro, depósito vs efectivo, reembolso)
- Quejas o reclamos sobre el servicio
- Preguntas sobre precios, tarifas, o políticas que no puedes responder
- Solicitudes especiales que salen de tu capacidad (cotizaciones, contratos, etc.)
- El cliente pide hablar con una persona real
- Cualquier situación que NO sea simplemente tomar un pedido nuevo

Cuando detectes que se necesita escalamiento:
1. Responde al cliente con empatía y brevedad, diciendo que un agente humano lo atenderá en breve.
2. OBLIGATORIAMENTE agrega al final este bloque JSON:

\`\`\`json
{"escalamiento": true, "razon": "descripción breve del problema", "categoria": "pago|queja|producto_danado|solicitud_especial|otro"}
\`\`\`

Ejemplos:
- Cliente: "el repartidor me cobró pero mi clienta ya depositó" → Escalar con categoría "pago"
- Cliente: "el pedido llegó dañado" → Escalar con categoría "producto_danado"
- Cliente: "quiero hablar con alguien" → Escalar con categoría "otro"
- Cliente: "cuánto cobran por envío a Colima?" → Escalar con categoría "solicitud_especial"`;

  if (isReturning) {
    return `Eres un asistente virtual de "Mandados ERP", un servicio de mandados y entregas en Ciudad Guzmán, Jalisco.
Tu ÚNICO trabajo es tomar pedidos.
${commonOrderTypes}

DATOS DEL CLIENTE (ya guardados):
- Nombre: ${ctx.name}
- Dirección de entrega habitual: ${ctx.lastDeliveryAddress}

COMO YA CONOCES AL CLIENTE:
- YA TIENES su nombre (${ctx.name}), NO lo preguntes de nuevo.
- Para la dirección de entrega, si no proporcionan una nueva, pregunta: ¿Lo entregamos en tu dirección habitual (${ctx.lastDeliveryAddress}) o prefieres otra?
- Si dice "sí", "la misma", "ahí mismo", usa la dirección habitual.
${commonRules}

- Si el cliente saluda, responde usando su nombre y pregunta qué necesita.`;
  }

  return `Eres un asistente virtual de "Mandados ERP", un servicio de mandados y entregas en Ciudad Guzmán, Jalisco.
Tu ÚNICO trabajo es tomar pedidos.
${commonOrderTypes}
${commonRules}

- Si el cliente saluda, responde brevemente y pregunta qué necesita pedir.`;
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

// ─────────────────────────────────────────────────────────
// Escalation extraction from ChatGPT response
// ─────────────────────────────────────────────────────────
interface EscalationData {
  escalamiento: boolean;
  razon: string;
  categoria: 'pago' | 'queja' | 'producto_danado' | 'solicitud_especial' | 'otro';
}

function extractEscalationData(response: string): EscalationData | null {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;

  try {
    const data = JSON.parse(jsonMatch[1]);
    if (data.escalamiento === true) {
      return data as EscalationData;
    }
  } catch (e) {
    console.error('⚠️ Error parsing escalation JSON:', e);
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
// Analyze image with GPT-4o Vision (extracts ALL order data)
// ─────────────────────────────────────────────────────────
async function analyzeImageWithVision(imageDataUrl: string, caption?: string): Promise<string> {
  const userContent: OAIContentPart[] = [
    {
      type: 'image_url',
      image_url: { url: imageDataUrl, detail: 'high' },
    },
    {
      type: 'text',
      text: caption
        ? `El cliente envió esta imagen con el texto: "${caption}". Analiza la imagen y extrae TODA la información relevante para un pedido de mandados.`
        : 'El cliente envió esta imagen. Analiza la imagen y extrae TODA la información relevante para un pedido de mandados.',
    },
  ];

  const messages: OAIMessage[] = [
    {
      role: 'system',
      content: `Eres un asistente experto en extraer información de imágenes para un servicio de mandados/entregas.

ANALIZA la imagen y extrae TODA la información que encuentres. La imagen puede ser:
1. Un TICKET de restaurante/negocio (impreso o digital)
2. Una NOTA escrita a mano
3. Una LISTA DE COMPRAS (mercado, tianguis, supermercado)
4. Una FOTO de productos
5. Un SCREENSHOT de un pedido

Para CADA tipo de imagen, extrae TODO lo que puedas leer:

Si es un TICKET DE RESTAURANTE/NEGOCIO:
- Nombre del negocio (esto es la DIRECCIÓN DE RECOLECCIÓN)
- Dirección del negocio (también es info de RECOLECCIÓN)  
- Teléfono del negocio
- Productos/artículos pedidos con cantidades y precios
- Total del pedido
- Nombre del CLIENTE (quien recibe)
- Dirección de ENTREGA del cliente
- Teléfono del cliente
- Cualquier referencia o indicación de entrega

Si es una NOTA ESCRITA A MANO o LISTA:
- Productos con cantidades
- Dirección (si aparece)
- Nombre (si aparece)
- Teléfono (si aparece)
- Cualquier otra información relevante

Si son PRODUCTOS/FOTOS:
- Describe los productos visibles

FORMATO DE RESPUESTA — usa EXACTAMENTE este formato:
PRODUCTOS: [lista de productos con cantidades]
NEGOCIO: [nombre del negocio si aparece, o "no especificado"]
DIRECCIÓN_RECOLECCIÓN: [dirección del negocio/donde recoger, o "no especificada"]
CLIENTE: [nombre del cliente/quien recibe, o "no especificado"]
DIRECCIÓN_ENTREGA: [dirección de entrega del cliente, o "no especificada"]
TELÉFONO: [teléfono si aparece, o "no especificado"]
TOTAL: [monto total si aparece, o "no especificado"]
NOTAS: [referencias, indicaciones especiales, o "ninguna"]
DUDAS: [si algo no se lee bien o es confuso, indícalo aquí, o "ninguna"]

Si no puedes leer algo claramente, indícalo en DUDAS. Es mejor decir "no se lee bien" que inventar datos.
Si la imagen no tiene información útil para un pedido, responde: "No pude identificar información de pedido en la imagen."
Responde SOLO con el formato indicado, sin explicaciones adicionales.`,
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

    // 2. Find conversation for this customer on WhatsApp
    //    Priority: active > most recent completed/abandoned (reactivate) > create new
    const channelLabel = `whatsapp:${formatPhone(customerPhone)}`;
    let conversation: any;

    // First, look for an active conversation
    let conversations = await supabaseGet(
      'chat_conversations',
      `customer_id=eq.${customer.id}&status=eq.active&select=*&order=started_at.desc&limit=1`
    );

    if (conversations.length > 0) {
      conversation = conversations[0];
      if (conversation.channel !== channelLabel) {
        await supabaseUpdate('chat_conversations', conversation.id, { channel: channelLabel });
      }
      console.log('💬 Conversación activa existente:', conversation.id);
    } else {
      // No active conversation — look for the most recent completed/abandoned one to reactivate
      const recentConvs = await supabaseGet(
        'chat_conversations',
        `customer_id=eq.${customer.id}&select=*&order=started_at.desc&limit=1`
      );

      if (recentConvs.length > 0) {
        // Reactivate the most recent conversation
        conversation = recentConvs[0];
        await supabaseUpdate('chat_conversations', conversation.id, {
          status: 'active',
          ended_at: null,
          channel: channelLabel,
        });
        conversation.status = 'active';
        console.log('💬 Conversación reactivada:', conversation.id, '(era', recentConvs[0].status + ')');
      } else {
        // No conversation at all — create a new one
        conversation = await supabaseInsert('chat_conversations', {
          customer_id: customer.id,
          channel: channelLabel,
          status: 'active',
        });
        if (!conversation) throw new Error('Failed to create conversation');
        console.log('💬 Nueva conversación creada:', conversation.id);
      }
    }

    // 3. If image, analyze it with Vision first
    let effectiveMessageText = messageText;

    if (imageDataUrl) {
      console.log('📸 Analizando imagen con GPT-4o Vision...');
      const imageAnalysis = await analyzeImageWithVision(imageDataUrl, messageText || undefined);
      console.log('📸 Datos extraídos de imagen:', imageAnalysis);

      // Format as structured data so GPT can use all extracted info
      if (messageText) {
        effectiveMessageText = `${messageText}\n\n[DATOS EXTRAÍDOS DE IMAGEN]\n${imageAnalysis}`;
      } else {
        effectiveMessageText = `[DATOS EXTRAÍDOS DE IMAGEN]\n${imageAnalysis}`;
      }
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
    const escalationData = extractEscalationData(gptResponse);
    let orderNumber: string | null = null;

    // 9a. Handle escalation to human
    if (escalationData) {
      console.log('🚨 ESCALAMIENTO detectado:', JSON.stringify(escalationData));

      // Pause the bot on this conversation
      await supabaseUpdate('chat_conversations', conversation.id, {
        bot_paused: true,
        escalation_reason: escalationData.razon,
        escalation_category: escalationData.categoria,
        escalated_at: new Date().toISOString(),
      });

      // Save the escalation marker message
      await supabaseInsert('chat_messages', {
        conversation_id: conversation.id,
        sender_type: 'bot',
        message: `[🚨 ESCALAMIENTO] Razón: ${escalationData.razon} | Categoría: ${escalationData.categoria} — Bot pausado, esperando atención humana.`,
      });

      console.log('⏸️ Bot pausado automáticamente — esperando intervención humana');
    }

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

        // Mark conversation as completed (with retry)
        console.log('📡 Actualizando estado de conversación a completed...');
        const updateResult = await supabaseUpdate('chat_conversations', conversation.id, {
          status: 'completed',
          ended_at: new Date().toISOString(),
        });
        console.log('📡 Resultado de actualización de estado:', JSON.stringify(updateResult));

        // Verify the update took effect
        const verifyConv = await supabaseGet(
          'chat_conversations',
          `id=eq.${conversation.id}&select=id,status`
        );
        if (verifyConv.length > 0 && verifyConv[0].status !== 'completed') {
          console.warn('⚠️ Estado no se actualizó en primer intento, reintentando...');
          // Retry with direct REST call
          const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_conversations?id=eq.${conversation.id}`, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify({ status: 'completed', ended_at: new Date().toISOString() }),
          });
          console.log('📡 Retry resultado:', retryRes.status, await retryRes.text());
        } else {
          console.log('✅ Estado de conversación actualizado a completed correctamente');
        }

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
    if (escalationData) {
      finalMessage += `\n\n👨‍💼 _Un agente te contactará en breve._`;
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
