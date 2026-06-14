import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID!;
const GRAPH_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;

// ─────────────────────────────────────────────────────────
// POST /api/whatsapp-template-send
// Sends an approved WhatsApp template message with 5 order parameters.
//
// Body: {
//   to: string             — Phone number (e.g. "521XXXXXXXXXX")
//   template_name: string  — Name of the approved Meta template
//   nombre_cliente: string — {{1}} Customer name
//   descripcion_producto: string — {{2}} Product/items description
//   direccion_recoleccion: string — {{3}} Pickup address
//   direccion_entrega: string — {{4}} Delivery address
//   total: string           — {{5}} Total (Comisión $35 o $45)
// }
// ─────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return res.status(500).json({ error: 'Missing WhatsApp credentials' });
  }

  const {
    to,
    template_name,
    nombre_repartidor,
    nombre_cliente,
    descripcion_producto,
    direccion_recoleccion,
    direccion_entrega,
    total,
    order_id,
  } = req.body || {};

  if (!to || !template_name || !order_id) {
    return res.status(400).json({
      error: 'Missing required fields: "to", "template_name" and "order_id"',
    });
  }

  // Build the template message payload for Meta Graph API
  // The Meta template "asignacion_mandado_repartidor" expects:
  // {{1}} = Nombre del Repartidor
  // {{2}} = Recolección
  // {{3}} = Entrega
  // {{4}} = Detalle del pedido
  // {{5}} = Cobro
  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template_name,
      language: { code: 'es_MX' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: nombre_repartidor || nombre_cliente || 'Repartidor' }, // {{1}}
            { type: 'text', text: direccion_recoleccion || 'Por confirmar' }, // {{2}}
            { type: 'text', text: direccion_entrega || 'Por confirmar' }, // {{3}}
            { type: 'text', text: descripcion_producto || 'Pedido' }, // {{4}}
            { type: 'text', text: total || '$0' }, // {{5}}
          ],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '0',
          parameters: [{ type: 'payload', payload: `DELIVERED_OK:${order_id}` }],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '1',
          parameters: [{ type: 'payload', payload: `ORDER_PROBLEM:${order_id}` }],
        },
      ],
    },
  };

  console.log('📤 Enviando plantilla WhatsApp:', JSON.stringify(payload, null, 2));

  try {
    const waRes = await fetch(GRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await waRes.json();

    if (!waRes.ok) {
      console.error('❌ WhatsApp template send error:', JSON.stringify(responseBody));
      return res.status(502).json({
        error: 'WhatsApp API rejected the template message',
        details: responseBody,
      });
    }

    console.log('✅ Plantilla enviada exitosamente:', JSON.stringify(responseBody));
    return res.status(200).json({ success: true, data: responseBody });
  } catch (err: any) {
    console.error('❌ WhatsApp template send exception:', err);
    return res.status(500).json({ error: err.message });
  }
}
