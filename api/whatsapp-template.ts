import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─────────────────────────────────────────────────────────
// Config — read from Vercel environment variables
// ─────────────────────────────────────────────────────────
const META_ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!;
const WABA_ID = process.env.WABA_ID!;
const GRAPH_API_VERSION = 'v21.0';
const TEMPLATES_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WABA_ID}/message_templates`;

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Extract positional variable placeholders ({{1}}, {{2}}, etc.) from a
 * template body text and return how many there are.
 */
function countPositionalVariables(text: string): number {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return 0;
  // Get unique numbers to handle duplicate references
  const unique = new Set(matches.map((m) => m.replace(/\{|\}/g, '')));
  return unique.size;
}

/**
 * Generate placeholder example values for each positional variable.
 * Meta requires at least one example per variable when creating templates.
 */
function generateExampleValues(count: number): string[] {
  const defaults = ['Juan Pérez', 'Pollo asado x1', 'Pizza Pomodori, Centro', 'Vigía 39, Col. Hacienda', '$45.00', 'ejemplo_6'];
  return Array.from({ length: count }, (_, i) => defaults[i] || `ejemplo_${i + 1}`);
}

// ─────────────────────────────────────────────────────────
// POST /api/whatsapp-template — Create a new template
// Body: {
//   name: string          — Template name (lowercase, underscores, no spaces)
//   body: string          — Template body text (can include {{1}}, {{2}}, etc.)
//   category?: string     — "UTILITY" | "MARKETING" | "AUTHENTICATION" (default: UTILITY)
//   language?: string     — BCP 47 language code (default: es_MX)
//   header?: string       — Optional header text
//   footer?: string       — Optional footer text
// }
//
// GET /api/whatsapp-template — List all templates
//
// DELETE /api/whatsapp-template — Delete a template
// Body: { name: string }
// ─────────────────────────────────────────────────────────
async function verifyAuth(req: VercelRequest): Promise<boolean> {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
        console.error('Missing Supabase env vars for auth verification');
        return false;
    }

    try {
        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey: anonKey,
                Authorization: authHeader
            }
        });
        return res.ok;
    } catch {
        return false;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthorized = await verifyAuth(req);
  if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing JWT' });
  }

  // ── Validate environment ──
  if (!META_ACCESS_TOKEN || !WABA_ID) {
    console.error('❌ Missing META_ACCESS_TOKEN or WABA_ID environment variables');
    return res.status(500).json({
      error: 'Server misconfiguration — missing Meta credentials',
    });
  }

  // ── Route by method ──
  switch (req.method) {
    case 'GET':
      return handleListTemplates(req, res);
    case 'POST':
      return handleCreateTemplate(req, res);
    case 'DELETE':
      return handleDeleteTemplate(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ─────────────────────────────────────────────────────────
// GET — List existing templates
// ─────────────────────────────────────────────────────────
async function handleListTemplates(_req: VercelRequest, res: VercelResponse) {
  try {
    const metaRes = await fetch(
      `${TEMPLATES_URL}?fields=name,status,category,language,components&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        },
      }
    );

    if (!metaRes.ok) {
      const errBody = await metaRes.text();
      console.error('❌ Meta API error (list templates):', errBody);
      return res.status(502).json({ error: 'Meta API error', details: errBody });
    }

    const data = await metaRes.json();
    return res.status(200).json({ success: true, templates: data.data || [] });
  } catch (err: any) {
    console.error('❌ Exception listing templates:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────
// POST — Create a new template
// ─────────────────────────────────────────────────────────
async function handleCreateTemplate(req: VercelRequest, res: VercelResponse) {
  const {
    name,
    body,
    category = 'UTILITY',
    language = 'es_MX',
    header,
    footer,
    buttons,
  } = req.body || {};

  // ── Validate required fields ──
  if (!name || !body) {
    return res.status(400).json({
      error: 'Missing required fields: "name" and "body" are required',
    });
  }

  // ── Validate template name (Meta requires lowercase + underscores only) ──
  const sanitizedName = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  if (!sanitizedName) {
    return res.status(400).json({
      error: 'Invalid template name — must contain at least one alphanumeric character',
    });
  }

  // ── Build components array ──
  const components: any[] = [];

  // Optional HEADER component
  if (header && header.trim()) {
    components.push({
      type: 'HEADER',
      format: 'TEXT',
      text: header.trim(),
    });
  }

  // BODY component (required)
  const varCount = countPositionalVariables(body);
  const bodyComponent: any = {
    type: 'BODY',
    text: body,
  };

  // Meta requires example values when the body contains variables
  if (varCount > 0) {
    bodyComponent.example = {
      body_text: [generateExampleValues(varCount)],
    };
  }
  components.push(bodyComponent);

  // Optional FOOTER component
  if (footer && footer.trim()) {
    components.push({
      type: 'FOOTER',
      text: footer.trim(),
    });
  }

  // Optional BUTTONS component (Quick Replies)
  if (buttons && Array.isArray(buttons) && buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: buttons.map((btn: any) => ({
        type: btn.type || 'QUICK_REPLY',
        text: btn.text,
      })),
    });
  }

  // ── Build the payload for Meta ──
  const payload = {
    name: sanitizedName,
    category: category.toUpperCase(),
    language,
    parameter_format: 'positional',
    components,
  };

  console.log('📤 Creating WhatsApp template:', JSON.stringify(payload, null, 2));

  try {
    const metaRes = await fetch(TEMPLATES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await metaRes.json();

    if (!metaRes.ok) {
      console.error('❌ Meta API error (create template):', JSON.stringify(responseBody));
      return res.status(502).json({
        error: 'Meta API rejected the template',
        details: responseBody,
      });
    }

    console.log('✅ Template created successfully:', JSON.stringify(responseBody));

    return res.status(200).json({
      success: true,
      message: `Plantilla "${sanitizedName}" creada exitosamente. Estado: EN REVISIÓN`,
      data: responseBody,
    });
  } catch (err: any) {
    console.error('❌ Exception creating template:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE — Delete a template by name
// ─────────────────────────────────────────────────────────
async function handleDeleteTemplate(req: VercelRequest, res: VercelResponse) {
  const { name } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Missing "name" in body' });
  }

  try {
    const metaRes = await fetch(`${TEMPLATES_URL}?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
      },
    });

    if (!metaRes.ok) {
      const errBody = await metaRes.text();
      console.error('❌ Meta API error (delete template):', errBody);
      return res.status(502).json({ error: 'Meta API error', details: errBody });
    }

    const data = await metaRes.json();
    return res.status(200).json({
      success: true,
      message: `Plantilla "${name}" eliminada exitosamente`,
      data,
    });
  } catch (err: any) {
    console.error('❌ Exception deleting template:', err);
    return res.status(500).json({ error: err.message });
  }
}
