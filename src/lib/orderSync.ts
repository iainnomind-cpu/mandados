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
        unit_price: item.unit_price,
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
// Assign order to driver
// ---------------------------------------------------------------------------
export async function assignOrderToDriver(
  orderId: string,
  driverId: string,
  assignedBy: string,
  estimatedDistance?: number,
  estimatedDuration?: number
) {
  const assignmentData = {
    order_id: orderId,
    driver_id: driverId,
    assigned_by: assignedBy,
    status: 'assigned' as const,
    estimated_distance_km: estimatedDistance,
    estimated_duration_min: estimatedDuration,
  };

  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .insert([assignmentData])
    .select()
    .single();

  if (assignmentError) throw assignmentError;

  // Update the order's status + assigned_driver_id column
  await supabase
    .from('orders')
    .update({ status: 'assigned', assigned_driver_id: driverId })
    .eq('id', orderId);

  await supabase
    .from('drivers')
    .update({ status: 'busy' })
    .eq('id', driverId);

  await supabase.from('order_events').insert([
    {
      order_id: orderId,
      event_type: 'assigned',
      description: 'Pedido asignado a conductor',
      user_id: assignedBy,
      metadata: { driver_id: driverId, assignment_id: assignment.id },
    },
  ]);

  return assignment;
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
    .select('total_deliveries')
    .eq('id', driverId)
    .single();

  await supabase
    .from('drivers')
    .update({
      status: 'available',
      total_deliveries: (driver?.total_deliveries || 0) + 1,
    })
    .eq('id', driverId);

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
    await supabase.from('transactions').insert([
      {
        order_id: orderId,
        assignment_id: assignmentId,
        driver_id: driverId,
        transaction_type: 'collection',
        amount: order.total_amount + (order.delivery_fee || 0),
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
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, driver_id, status')
    .eq('order_id', orderId)
    .in('status', ['assigned', 'accepted', 'in_progress'])
    .maybeSingle();

  if (assignment) {
    await supabase
      .from('assignments')
      .update({ status: 'cancelled' })
      .eq('id', assignment.id);

    const { count } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', assignment.driver_id)
      .in('status', ['assigned', 'accepted', 'in_progress']);

    if (count === 0) {
      await supabase
        .from('drivers')
        .update({ status: 'available' })
        .eq('id', assignment.driver_id);
    }
  }

  await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
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
// Delete order (hard delete — cascades to order_items + order_events)
// ---------------------------------------------------------------------------
export async function deleteOrderById(orderId: string) {
  // Cancel any active assignments first to free up the driver
  await cancelOrder(orderId, 'Pedido eliminado', undefined);

  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) throw error;
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
