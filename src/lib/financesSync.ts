import { supabase } from './supabase';

/**
 * Registers an anticipo (cash advance) for a specific order and driver.
 */
export async function registerAnticipo(
    orderId: string,
    driverId: string,
    amount: number
): Promise<void> {
    const { error } = await supabase.from('cod_transactions').insert([
        {
            order_id: orderId,
            driver_id: driverId,
            transaction_type: 'anticipo',
            amount: amount,
            status: 'pending'
        }
    ]);

    if (error) {
        console.error('Error al registrar anticipo:', error);
        throw new Error('No se pudo registrar el anticipo. Verifica tu conexión e intenta de nuevo.');
    }
}

/**
 * Calculates a driver's pending remittance (Anticipos and Collections).
 * If transactionIds is provided, only calculates for those specific transactions.
 */
export async function calculateDriverRemittance(driverId: string, transactionIds?: string[]) {
    // 1. Fetch pending cod_transactions for the driver
    let query = supabase
        .from('cod_transactions')
        .select('*, order:order_id(order_number)')
        .eq('driver_id', driverId)
        .eq('status', 'pending');

    if (transactionIds && transactionIds.length > 0) {
        query = query.in('id', transactionIds);
    }

    const { data: pendingTransactions, error: txError } = await query;
    if (txError) throw txError;

    let totalAdvances = 0;
    let totalCollected = 0;

    (pendingTransactions || []).forEach(tx => {
        if (tx.transaction_type === 'anticipo') {
            totalAdvances += Number(tx.amount);
        } else if (tx.transaction_type === 'cobro_cliente' && tx.payment_method === 'cash') {
            totalCollected += Number(tx.amount);
        }
    });

    let driverCommissions = 0;
    const uniqueOrderIds = Array.from(new Set((pendingTransactions || []).map(t => t.order_id)));

    // Structure order breakdown for UI
    const orderBreakdown: Record<string, {
        orderId: string,
        orderNumber: string,
        advances: number,
        collected: number,
        commission: number,
        net: number,
        transactionIds: string[]
    }> = {};

    if (uniqueOrderIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_number, delivery_fee')
            .in('id', uniqueOrderIds);

        if (!ordersError && orders) {
            orders.forEach(o => {
                const commission = o.delivery_fee || 0;
                driverCommissions += commission;

                orderBreakdown[o.id] = {
                    orderId: o.id,
                    orderNumber: o.order_number,
                    advances: 0,
                    collected: 0,
                    commission: commission,
                    net: 0,
                    transactionIds: []
                };
            });
        }
    }

    // Assign amounts to order breakdown
    (pendingTransactions || []).forEach(tx => {
        if (orderBreakdown[tx.order_id]) {
            orderBreakdown[tx.order_id].transactionIds.push(tx.id);
            if (tx.transaction_type === 'anticipo') {
                orderBreakdown[tx.order_id].advances += Number(tx.amount);
            } else if (tx.transaction_type === 'cobro_cliente' && tx.payment_method === 'cash') {
                orderBreakdown[tx.order_id].collected += Number(tx.amount);
            }
        }
    });

    // Calculate net per order
    Object.values(orderBreakdown).forEach(ob => {
        ob.net = ob.collected - ob.advances - ob.commission;
    });

    const netRemittanceDue = totalCollected - totalAdvances - driverCommissions;

    return {
        totalAdvances,
        totalCollected,
        driverCommissions,
        netRemittanceDue,
        pendingTransactionIds: (pendingTransactions || []).map(t => t.id),
        orderBreakdown: Object.values(orderBreakdown)
    };
}

/**
 * Process and finalize the reconciliation remittance for selected transactions.
 */
export async function processRemittance(driverId: string, transactionIds: string[]): Promise<void> {
    if (!transactionIds || transactionIds.length === 0) {
        throw new Error('No hay transacciones seleccionadas para liquidar.');
    }

    const calculations = await calculateDriverRemittance(driverId, transactionIds);

    // Insert into driver_remittances
    const { error: insertError } = await supabase.from('driver_remittances').insert([{
        driver_id: driverId,
        period_date: new Date().toISOString().slice(0, 10),
        total_collected: calculations.totalCollected,
        total_advances: calculations.totalAdvances,
        driver_commissions: calculations.driverCommissions,
        net_remittance_due: calculations.netRemittanceDue,
        status: 'pending' // can be marked as 'paid_to_company' via UI later
    }]);

    if (insertError) {
        console.error('Error inserting remittance:', insertError);
        throw new Error('Error al generar la liquidación');
    }

    // Update cod_transactions to 'reconciled'
    const { error: updateError } = await supabase
        .from('cod_transactions')
        .update({ status: 'reconciled' })
        .in('id', transactionIds);

    if (updateError) {
        console.error('Error updating cod_transactions:', updateError);
        throw new Error('Liquidación generada pero hubo error al actualizar el estado de las transacciones.');
    }
}
