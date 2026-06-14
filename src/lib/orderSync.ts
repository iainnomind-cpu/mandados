import { supabase } from './supabase';
import { Order, OrderItemDraft } from '../types';

// ---------------------------------------------------------------------------
// Create order + relational items (new approach)
// ---------------------------------------------------------------------------
export async function createOrderWithItems(
  orderData: Partial<Order>,
  items: OrderItemDraft[]
) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{ ...orderData, status: 'pending' }])
    .select()
    .single();

  if (orderError) throw orderError;

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: (item as any).unit_price ?? 0, // Descriptive items — no pricing
      }))
    );
    if (itemsError) throw itemsError;
  }

  await supabase.from('order_events').insert([
    {
      order_id: order.id,
      event_type: 'created',
      description: `Pedido creado`,
      metadata: { source: orderData.source },
    },
  ]);

  return order;
}

// ---------------------------------------------------------------------------
// Legacy create (kept for backward compat with old JSONB approach)
// ---------------------------------------------------------------------------
export async function createOrderWithTransaction(orderData: Partial<Order>) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([orderData])
    .select()
    .single();

  if (orderError) throw orderError;

  await supabase.from('order_events').insert([
    {
      order_id: order.id,
      event_type: 'created',
      description: `Pedido creado desde ${orderData.source}`,
      metadata: { source: orderData.source, priority: orderData.priority },
    },
  ]);

  return order;
}

// ---------------------------------------------------------------------------
// Update order status + write event log
// ---------------------------------------------------------------------------
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  userId?: string
) {
  const updatePayload: Record<string, string> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId)
    .select()
    .single();

  if (orderError) throw orderError;

  await supabase.from('order_events').insert([
    {
      order_id: orderId,
      event_type: 'status_change',
      description: `Estado cambiado a ${newStatus}`,
      user_id: userId,
      metadata: { new_status: newStatus },
    },
  ]);

  return order;
}

// ---------------------------------------------------------------------------
// Update order total amount (e.g. WhatsApp orders arriving at $0)
// ---------------------------------------------------------------------------
export async function updateOrderAmount(
  orderId: string,
  newAmount: number,
  userId?: string
) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .update({ total_amount: newAmount, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();

  if (orderError) throw orderError;

  await supabase.from('order_events').insert([
    {
      order_id: orderId,
      event_type: 'amount_updated',
      description: `Monto actualizado a $${newAmount.toFixed(2)}`,
      user_id: userId,
      metadata: { new_amount: newAmount },
    },
  ]);

  return order;
}

// ---------------------------------------------------------------------------
// Mark order as delivered (Admin/Dispatcher fallback or direct)
// ---------------------------------------------------------------------------
export async function markOrderAsDelivered(orderId: string, userId?: string) {
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('*, driver:assigned_driver_id(id)')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) throw fetchError || new Error('Order not found');

  let assignmentId = null;
  if (order.assigned_driver_id) {
    const { data: assignment } = await supabase
      .from('assignments')
      .select('id')
      .eq('order_id', orderId)
      .eq('driver_id', order.assigned_driver_id)
      .in('status', ['assigned', 'accepted', 'in_progress'])
      .maybeSingle();
    if (assignment) assignmentId = assignment.id;
  }

  const now = new Date().toISOString();

  if (assignmentId) {
    await supabase
      .from('assignments')
      .update({ status: 'completed', delivered_at: now })
      .eq('id', assignmentId);

    const { data: driver } = await supabase
      .from('drivers')
      .select('total_deliveries, active_load_count')
      .eq('id', order.assigned_driver_id)
      .single();

    if (driver) {
      // Count remaining active assignments AFTER completing this one
      const { count: remainingActive } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', order.assigned_driver_id)
        .in('status', ['assigned', 'accepted', 'in_progress']);

      const newLoad = Math.max(0, remainingActive ?? 0);
      await supabase
        .from('drivers')
        .update({
          status: newLoad === 0 ? 'available' : 'busy',
          active_load_count: newLoad,
          total_deliveries: (driver.total_deliveries || 0) + 1,
        })
        .eq('id', order.assigned_driver_id);
    }
  }

  await supabase
    .from('orders')
    .update({ status: 'delivered', updated_at: now })
    .eq('id', orderId);

  await supabase.from('order_events').insert([
    {
      order_id: orderId,
      event_type: 'delivered',
      description: 'Pedido marcado como entregado',
      user_id: userId,
      metadata: { assignment_id: assignmentId },
    },
  ]);

  if (order.payment_method === 'cash') {
    await supabase.from('cod_transactions').insert([
      {
        order_id: orderId,
        driver_id: order.assigned_driver_id || null,
        transaction_type: 'cobro_cliente',
        amount: order.total_amount ?? 0,
        payment_method: 'cash',
        status: 'pending',
      },
    ]);
  }
}





// ---------------------------------------------------------------------------
// Complete delivery
// ---------------------------------------------------------------------------
export async function completeDelivery(
  assignmentId: string,
  orderId: string,
  driverId: string,
  actualDistance?: number,
  actualDuration?: number
) {
  const now = new Date().toISOString();

  await supabase
    .from('assignments')
    .update({
      status: 'completed',
      delivered_at: now,
      actual_distance_km: actualDistance,
      actual_duration_min: actualDuration,
    })
    .eq('id', assignmentId);

  await supabase
    .from('orders')
    .update({ status: 'delivered', updated_at: now })
    .eq('id', orderId);

  const { data: driver } = await supabase
    .from('drivers')
    .select('total_deliveries, active_load_count')
    .eq('id', driverId)
    .single();

  if (driver) {
    // Count remaining active assignments AFTER completing this one
    const { count: remainingActive } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'accepted', 'in_progress']);

    const newLoad = Math.max(0, remainingActive ?? 0);
    await supabase
      .from('drivers')
      .update({
        status: newLoad === 0 ? 'available' : 'busy',
        active_load_count: newLoad,
        total_deliveries: (driver.total_deliveries || 0) + 1,
      })
      .eq('id', driverId);
  }

  await supabase.from('order_events').insert([
    {
      order_id: orderId,
      event_type: 'delivered',
      description: 'Pedido entregado',
      metadata: { assignment_id: assignmentId },
    },
  ]);

  const { data: order } = await supabase
    .from('orders')
    .select('total_amount, delivery_fee, payment_method')
    .eq('id', orderId)
    .single();

  if (order && order.payment_method === 'cash') {
    await supabase.from('cod_transactions').insert([
      {
        order_id: orderId,
        driver_id: driverId,
        transaction_type: 'cobro_cliente',
        amount: order.total_amount ?? 0,
        payment_method: 'cash',
        status: 'pending',
      },
    ]);
  }
}

// ---------------------------------------------------------------------------
// Cancel order
// ---------------------------------------------------------------------------
export async function cancelOrder(
  orderId: string,
  reason: string,
  userId?: string
) {
  // 1. Get the order to find the assigned driver
  const { data: order } = await supabase
    .from('orders')
    .select('assigned_driver_id')
    .eq('id', orderId)
    .single();

  const driverId = order?.assigned_driver_id;

  // 2. Cancel active assignment if it exists
  if (driverId) {
    await supabase
      .from('assignments')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId)
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'accepted', 'in_progress']);

    // 3. Recalculate remaining active assignments for this driver
    const { count: remainingActive } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'accepted', 'in_progress']);

    const newLoad = Math.max(0, remainingActive ?? 0);
    await supabase
      .from('drivers')
      .update({
        status: newLoad === 0 ? 'available' : 'busy',
        active_load_count: newLoad,
      })
      .eq('id', driverId);
  }

  // 4. Update the order itself
  await supabase
    .from('orders')
    .update({ 
      status: 'cancelled', 
      updated_at: new Date().toISOString(),
      // Unassign the driver so it's fully cleared from their load visually
      assigned_driver_id: null 
    })
    .eq('id', orderId);

  await supabase.from('order_events').insert([
    {
      order_id: orderId,
      event_type: 'cancelled',
      description: reason,
      user_id: userId,
      metadata: { reason },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Delete order (soft-delete — marks as cancelled to avoid FK violations)
// ---------------------------------------------------------------------------
export async function deleteOrderById(orderId: string) {
  // Cancel any active assignments and mark the order as 'cancelled'.
  // We intentionally do NOT hard-delete to preserve referential integrity
  // with assignments, cod_transactions, chat_messages, etc.
  await cancelOrder(orderId, 'Pedido eliminado por administrador', undefined);
}

// ---------------------------------------------------------------------------
// Fetch single order with joined order_items
// ---------------------------------------------------------------------------
export async function getOrderWithItems(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(*),
      driver:assigned_driver_id(
        id, vehicle_plate, vehicle_type,
        profiles:user_id(full_name)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}
