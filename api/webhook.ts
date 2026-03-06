import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // ─── GET: Meta Webhook Verification ───
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }

    console.warn('⚠️ Verificación fallida: token inválido');
    return res.status(403).json({ error: 'Token de verificación inválido' });
  }

  // ─── POST: Mensajes entrantes de WhatsApp ───
  if (req.method === 'POST') {
    const body = req.body;

    // Meta requiere respuesta 200 inmediata
    console.log('📩 Evento recibido de WhatsApp:', JSON.stringify(body, null, 2));

    // Procesar mensajes entrantes
    if (body?.object === 'whatsapp_business_account') {
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field === 'messages') {
            const messages = change.value?.messages || [];

            for (const message of messages) {
              const from = message.from; // Número del remitente
              const msgType = message.type;
              const msgBody = msgType === 'text' ? message.text?.body : '';

              console.log(`📱 Mensaje de ${from}: [${msgType}] ${msgBody}`);

              // TODO: Integrar con ChatGPT API para procesar pedidos
              // TODO: Responder al usuario vía WhatsApp Cloud API
            }
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  }

  // Cualquier otro método
  return res.status(405).json({ error: 'Método no permitido' });
}
