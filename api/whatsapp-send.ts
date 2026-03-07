import type { VercelRequest, VercelResponse } from '@vercel/node';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID!;
const GRAPH_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;

/**
 * POST /api/whatsapp-send
 * Body: { to: string, message: string }
 *
 * Used by operators in the Chat panel to send a WhatsApp message
 * directly to the customer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, message } = req.body || {};

    if (!to || !message) {
        return res.status(400).json({ error: 'Missing "to" or "message" in body' });
    }

    try {
        const waRes = await fetch(GRAPH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: message },
            }),
        });

        if (!waRes.ok) {
            const errBody = await waRes.text();
            console.error('❌ WhatsApp send error:', errBody);
            return res.status(502).json({ error: 'WhatsApp API error', details: errBody });
        }

        const data = await waRes.json();
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('❌ WhatsApp send exception:', err);
        return res.status(500).json({ error: err.message });
    }
}
