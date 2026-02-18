import { supabase } from './supabase';

export async function recordCollection(
  orderId: string,
  assignmentId: string,
  driverId: string,
  amount: number,
  paymentMethod: 'cash' | 'card' | 'transfer',
  reference?: string
) {
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert([
      {
        order_id: orderId,
        assignment_id: assignmentId,
        driver_id: driverId,
        transaction_type: 'collection',
        amount,
        payment_method: paymentMethod,
        status: 'completed',
        reference,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('orders')
    .update({ payment_status: 'paid' })
    .eq('id', orderId);

  return transaction;
}

export async function recordCommission(
  orderId: string,
  assignmentId: string,
  driverId: string,
  commissionAmount: number
) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([
      {
        order_id: orderId,
        assignment_id: assignmentId,
        driver_id: driverId,
        transaction_type: 'commission',
        amount: commissionAmount,
        payment_method: 'cash',
        status: 'completed',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createReconciliation(
  driverId: string,
  reconciliationDate: string,
  reconciledBy: string
) {
  const dateStart = new Date(reconciliationDate);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(reconciliationDate);
  dateEnd.setHours(23, 59, 59, 999);

  const { data: collections } = await supabase
    .from('transactions')
    .select('amount')
    .eq('driver_id', driverId)
    .eq('transaction_type', 'collection')
    .gte('created_at', dateStart.toISOString())
    .lte('created_at', dateEnd.toISOString());

  const { data: commissions } = await supabase
    .from('transactions')
    .select('amount')
    .eq('driver_id', driverId)
    .eq('transaction_type', 'commission')
    .gte('created_at', dateStart.toISOString())
    .lte('created_at', dateEnd.toISOString());

  const { data: advances } = await supabase
    .from('driver_advances')
    .select('amount')
    .eq('driver_id', driverId)
    .eq('status', 'disbursed')
    .gte('created_at', dateStart.toISOString())
    .lte('created_at', dateEnd.toISOString());

  const totalCollections = collections?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalCommissions = commissions?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const advancesDeducted = advances?.reduce((sum, a) => sum + a.amount, 0) || 0;
  const netAmount = totalCollections - totalCommissions - advancesDeducted;

  const { data: reconciliation, error } = await supabase
    .from('reconciliations')
    .insert([
      {
        driver_id: driverId,
        reconciliation_date: reconciliationDate,
        total_collections: totalCollections,
        total_commissions: totalCommissions,
        advances_deducted: advancesDeducted,
        net_amount: netAmount,
        status: 'completed',
        reconciled_by: reconciledBy,
        completed_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('transactions')
    .update({ status: 'reconciled' })
    .eq('driver_id', driverId)
    .gte('created_at', dateStart.toISOString())
    .lte('created_at', dateEnd.toISOString());

  if (advances && advances.length > 0) {
    await supabase
      .from('driver_advances')
      .update({ status: 'deducted' })
      .eq('driver_id', driverId)
      .eq('status', 'disbursed')
      .gte('created_at', dateStart.toISOString())
      .lte('created_at', dateEnd.toISOString());
  }

  return reconciliation;
}
