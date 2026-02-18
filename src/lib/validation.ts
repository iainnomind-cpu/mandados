export function validateOrder(orderData: {
  customer_id?: string | null;
  order_type: string;
  pickup_address: { street: string; city: string };
  delivery_address: { street: string; city: string };
  total_amount: number;
  delivery_fee: number;
}) {
  const errors: string[] = [];

  if (!orderData.customer_id) {
    errors.push('Cliente es requerido');
  }

  if (!orderData.order_type) {
    errors.push('Tipo de pedido es requerido');
  }

  if (!orderData.pickup_address?.street || !orderData.pickup_address?.city) {
    errors.push('Dirección de recogida completa es requerida');
  }

  if (!orderData.delivery_address?.street || !orderData.delivery_address?.city) {
    errors.push('Dirección de entrega completa es requerida');
  }

  if (orderData.total_amount < 0) {
    errors.push('Monto total debe ser mayor o igual a 0');
  }

  if (orderData.delivery_fee < 0) {
    errors.push('Tarifa de envío debe ser mayor o igual a 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateDriver(driverData: {
  vehicle_plate?: string;
  vehicle_type?: string;
  license_number?: string;
}) {
  const errors: string[] = [];

  if (!driverData.vehicle_plate) {
    errors.push('Placa del vehículo es requerida');
  }

  if (!driverData.vehicle_type) {
    errors.push('Tipo de vehículo es requerido');
  }

  if (!driverData.license_number) {
    errors.push('Número de licencia es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateAssignment(assignmentData: {
  order_id: string;
  driver_id: string;
}) {
  const errors: string[] = [];

  if (!assignmentData.order_id) {
    errors.push('ID de pedido es requerido');
  }

  if (!assignmentData.driver_id) {
    errors.push('ID de conductor es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateTransaction(transactionData: {
  driver_id?: string | null;
  transaction_type: string;
  amount: number;
}) {
  const errors: string[] = [];

  if (!transactionData.driver_id) {
    errors.push('Conductor es requerido');
  }

  if (!transactionData.transaction_type) {
    errors.push('Tipo de transacción es requerido');
  }

  if (transactionData.amount <= 0) {
    errors.push('Monto debe ser mayor a 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
