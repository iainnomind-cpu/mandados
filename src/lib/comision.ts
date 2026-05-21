// ---------------------------------------------------------------------------
// Lógica de comisión automática por tipo de servicio
// ---------------------------------------------------------------------------

export type ServiceType = 'sencillo' | 'complejo';

/**
 * Calcula la comisión del servicio según el tipo de pedido.
 *
 * - **Sencillo** ($35): Recolección / entrega directa.
 * - **Complejo** ($45): Lista de compras / múltiples movimientos.
 */
export function calcularComision(tipo: ServiceType): number {
  return tipo === 'sencillo' ? 35 : 45;
}

/** Labels para el UI */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  sencillo: 'Sencillo',
  complejo: 'Complejo',
};

export const SERVICE_TYPE_DESCRIPTIONS: Record<ServiceType, string> = {
  sencillo: 'Recolección / entrega directa',
  complejo: 'Lista de compras / múltiples movimientos',
};
