import { supabase } from './supabase';
import { calcularComision } from './comision';
import type { ServiceType } from './comision';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriverSettlementRow {
  driverId: string;
  driverName: string;
  vehiclePlate: string;
  sencilloCount: number;
  complejoCount: number;
  totalComisiones: number;
  settled: boolean;          // true if already settled today
  settlementId?: string;     // if settled, the id of the settlement record
}

export interface SettlementRecord {
  id: string;
  driver_id: string;
  driver_name: string;
  period_date: string;
  sencillo_count: number;
  complejo_count: number;
  total_expected: number;
  total_delivered: number;
  difference: number;
  status: 'settled';
  created_at: string;
}

// ---------------------------------------------------------------------------
// Get delivered orders for a specific date, grouped by driver
// ---------------------------------------------------------------------------
export async function getDriverSettlementData(dateStr: string): Promise<DriverSettlementRow[]> {
  // 1. Fetch all delivered orders for the given date
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, assigned_driver_id, service_type, delivery_fee')
    .eq('status', 'delivered')
    .gte('updated_at', dayStart)
    .lte('updated_at', dayEnd)
    .not('assigned_driver_id', 'is', null);

  if (error) throw error;

  // 2. Fetch all drivers
  const { data: drivers, error: driversErr } = await supabase
    .from('drivers')
    .select('id, full_name, vehicle_plate');

  if (driversErr) throw driversErr;

  const driverMap = new Map<string, { name: string; plate: string }>();
  (drivers || []).forEach(d => {
    driverMap.set(d.id, { name: d.full_name || 'Sin nombre', plate: d.vehicle_plate || 'Sin placa' });
  });

  // 3. Fetch today's settlements
  const { data: settlements } = await supabase
    .from('driver_remittances')
    .select('id, driver_id')
    .eq('period_date', dateStr);

  const settledDrivers = new Map<string, string>();
  (settlements || []).forEach(s => {
    settledDrivers.set(s.driver_id, s.id);
  });

  // 4. Group orders by driver
  const grouped: Record<string, { sencillo: number; complejo: number }> = {};
  (orders || []).forEach(o => {
    const did = o.assigned_driver_id;
    if (!did) return;
    if (!grouped[did]) grouped[did] = { sencillo: 0, complejo: 0 };
    const st: ServiceType = (o.service_type === 'complejo') ? 'complejo' : 'sencillo';
    grouped[did][st]++;
  });

  // 5. Build result
  const result: DriverSettlementRow[] = [];
  for (const [driverId, counts] of Object.entries(grouped)) {
    const info = driverMap.get(driverId) || { name: 'Desconocido', plate: 'N/A' };
    const totalComisiones =
      counts.sencillo * calcularComision('sencillo') +
      counts.complejo * calcularComision('complejo');

    result.push({
      driverId,
      driverName: info.name,
      vehiclePlate: info.plate,
      sencilloCount: counts.sencillo,
      complejoCount: counts.complejo,
      totalComisiones,
      settled: settledDrivers.has(driverId),
      settlementId: settledDrivers.get(driverId),
    });
  }

  return result.sort((a, b) => a.driverName.localeCompare(b.driverName));
}

// ---------------------------------------------------------------------------
// Get KPI data for the finance dashboard
// ---------------------------------------------------------------------------
export async function getFinanceKPIs(dateStr: string) {
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  // Total delivered today → commissions earned
  const { data: delivered } = await supabase
    .from('orders')
    .select('delivery_fee, service_type')
    .eq('status', 'delivered')
    .gte('updated_at', dayStart)
    .lte('updated_at', dayEnd);

  const totalComisiones = (delivered || []).reduce((sum, o) => {
    const st: ServiceType = (o.service_type === 'complejo') ? 'complejo' : 'sencillo';
    return sum + calcularComision(st);
  }, 0);

  // Pending in street (assigned + in_transit)
  const { data: inStreet } = await supabase
    .from('orders')
    .select('delivery_fee, service_type')
    .in('status', ['assigned', 'in_transit']);

  const pendientesCalle = (inStreet || []).reduce((sum, o) => {
    const st: ServiceType = (o.service_type === 'complejo') ? 'complejo' : 'sencillo';
    return sum + calcularComision(st);
  }, 0);

  // Already settled today
  const { data: settledToday } = await supabase
    .from('driver_remittances')
    .select('total_expected')
    .eq('period_date', dateStr);

  const liquidadas = (settledToday || []).reduce((sum, s) => sum + (s.total_expected || 0), 0);

  return { totalComisiones, pendientesCalle, liquidadas };
}

// ---------------------------------------------------------------------------
// Process a settlement (corte de caja)
// ---------------------------------------------------------------------------
export async function processSettlement(
  driverId: string,
  driverName: string,
  dateStr: string,
  sencilloCount: number,
  complejoCount: number,
  totalExpected: number,
  totalDelivered: number,
): Promise<void> {
  const difference = totalDelivered - totalExpected;

  const { error } = await supabase.from('driver_remittances').insert([{
    driver_id: driverId,
    period_date: dateStr,
    // Re-use existing columns for the new model
    total_collected: totalDelivered,
    total_advances: 0,
    driver_commissions: totalExpected,
    net_remittance_due: difference,
    status: 'paid_to_company',
  }]);

  if (error) {
    console.error('Error inserting settlement:', error);
    throw new Error('Error al registrar la liquidación: ' + error.message);
  }
}

// ---------------------------------------------------------------------------
// Get settlement history
// ---------------------------------------------------------------------------
export async function getSettlementHistory(limit = 30): Promise<SettlementRecord[]> {
  const { data, error } = await supabase
    .from('driver_remittances')
    .select('*, driver:driver_id(full_name, vehicle_plate)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    driver_id: row.driver_id,
    driver_name: row.driver?.full_name || 'Desconocido',
    period_date: row.period_date,
    sencillo_count: 0, // will be calculated from total if needed
    complejo_count: 0,
    total_expected: row.driver_commissions || 0,
    total_delivered: row.total_collected || 0,
    difference: row.net_remittance_due || 0,
    status: 'settled' as const,
    created_at: row.created_at,
  }));
}
