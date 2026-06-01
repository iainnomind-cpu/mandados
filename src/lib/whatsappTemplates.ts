// ─────────────────────────────────────────────────────────
// WhatsApp Template API client
// Calls the serverless function at /api/whatsapp-template
// ─────────────────────────────────────────────────────────

export interface TemplateCreatePayload {
  /** Template name (spaces will be converted to underscores, forced lowercase) */
  name: string;
  /** Template body text — can include {{1}}, {{2}}, etc. */
  body: string;
  /** Template category — defaults to UTILITY */
  category?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  /** Language code — defaults to es_MX */
  language?: string;
  /** Optional header text */
  header?: string;
  /** Optional footer text */
  footer?: string;
  /** Optional Quick Reply buttons */
  buttons?: Array<{ type: string; text: string }>;
}

export interface MetaTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: any;
}

export interface MetaTemplate {
  name: string;
  status: string;
  category: string;
  language: string;
  components: MetaTemplateComponent[];
  id?: string;
}

export interface TemplateApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  details?: any;
  templates?: MetaTemplate[];
}

const API_BASE = '/api/whatsapp-template';

/**
 * Create a new WhatsApp message template via Meta's API.
 * Called when the admin clicks "Guardar" in the template config panel.
 */
export async function createWhatsAppTemplate(
  payload: TemplateCreatePayload
): Promise<TemplateApiResponse> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data: TemplateApiResponse = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(
      data.error || data.details?.error?.message || 'Error al crear la plantilla'
    );
  }

  return data;
}

/**
 * List all existing WhatsApp message templates.
 */
export async function listWhatsAppTemplates(): Promise<MetaTemplate[]> {
  const res = await fetch(API_BASE, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const data: TemplateApiResponse = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al listar plantillas');
  }

  return data.templates || [];
}

/**
 * Delete a WhatsApp message template by name.
 */
export async function deleteWhatsAppTemplate(
  name: string
): Promise<TemplateApiResponse> {
  const res = await fetch(API_BASE, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  const data: TemplateApiResponse = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al eliminar la plantilla');
  }

  return data;
}
