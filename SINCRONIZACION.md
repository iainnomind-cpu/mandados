# Sistema de Sincronización de Datos - ERP

## Resumen de Mejoras Implementadas

### 1. Módulo de Sincronización de Pedidos (`src/lib/orderSync.ts`)

Funciones centralizadas para garantizar la integridad de datos en operaciones de pedidos:

- **`createOrderWithTransaction`**: Crea un pedido y automáticamente registra el evento en `order_events`
- **`updateOrderStatus`**: Actualiza el estado del pedido y registra el cambio en el historial
- **`assignOrderToDriver`**: Asigna un pedido a un conductor, actualizando:
  - Tabla `assignments` con la nueva asignación
  - Estado del pedido a "assigned"
  - Estado del conductor a "busy"
  - Registro del evento en `order_events`
- **`completeDelivery`**: Completa una entrega, sincronizando:
  - Estado de la asignación a "completed"
  - Estado del pedido a "delivered"
  - Estado del conductor a "available"
  - Contador de entregas totales del conductor
  - Creación automática de transacción de cobro si es pago en efectivo
  - Registro del evento de entrega
- **`cancelOrder`**: Cancela un pedido y libera el conductor asignado si existe

### 2. Módulo de Sincronización Financiera (`src/lib/transactionSync.ts`)

Funciones para mantener la consistencia de transacciones financieras:

- **`recordCollection`**: Registra un cobro y actualiza el estado de pago del pedido
- **`recordCommission`**: Registra una comisión del conductor
- **`createReconciliation`**: Crea una conciliación automática que:
  - Calcula totales de cobros, comisiones y anticipos del día
  - Actualiza el estado de todas las transacciones a "reconciled"
  - Actualiza el estado de anticipos a "deducted"
  - Calcula el monto neto automáticamente

### 3. Sincronización en Tiempo Real (`src/hooks/useRealtimeSync.ts`)

Hooks personalizados para actualizar datos automáticamente:

- **`useRealtimeOrders`**: Escucha cambios en la tabla `orders`
- **`useRealtimeAssignments`**: Escucha cambios en la tabla `assignments`
- **`useRealtimeDrivers`**: Escucha cambios en la tabla `drivers`
- **`useRealtimeTransactions`**: Escucha cambios en la tabla `transactions`
- **`useRealtimeChat`**: Escucha nuevos mensajes en conversaciones específicas

Estos hooks permiten que todos los módulos se actualicen automáticamente cuando hay cambios en la base de datos.

### 4. Validación de Datos (`src/lib/validation.ts`)

Funciones de validación centralizadas:

- **`validateOrder`**: Valida datos de pedidos
- **`validateDriver`**: Valida datos de conductores
- **`validateAssignment`**: Valida asignaciones
- **`validateTransaction`**: Valida transacciones

### 5. Sistema de Notificaciones (`src/components/NotificationToast.tsx`)

Componente reutilizable para mostrar notificaciones toast con 4 tipos:
- success (verde)
- error (rojo)
- warning (naranja)
- info (azul)

## Módulos Actualizados

### OrderManagement
- Usa `createOrderWithTransaction` para crear pedidos con historial automático
- Implementa sincronización en tiempo real con `useRealtimeOrders`

### DispatchManagement
- Usa `assignOrderToDriver` para asignaciones atómicas
- Sincroniza pedidos, conductores y asignaciones en tiempo real
- Los cambios se reflejan inmediatamente en todos los usuarios

### FinanceManagement
- Usa `createReconciliation` para conciliaciones automáticas calculadas
- Sincroniza transacciones en tiempo real
- Los estados de transacciones se actualizan automáticamente

### Chatbot
- Implementa `useRealtimeChat` para mensajes en tiempo real
- Los mensajes aparecen instantáneamente sin necesidad de recargar

## Flujo de Datos Garantizado

### Creación de Pedido
1. Usuario crea pedido → `createOrderWithTransaction`
2. Se inserta en `orders`
3. Se registra evento en `order_events`
4. Todos los módulos con `useRealtimeOrders` se actualizan automáticamente

### Asignación de Conductor
1. Dispatcher asigna conductor → `assignOrderToDriver`
2. Se crea registro en `assignments`
3. Se actualiza estado de `orders` a "assigned"
4. Se actualiza estado de `drivers` a "busy"
5. Se registra evento en `order_events`
6. Dashboard, Dispatch y Fleet se sincronizan automáticamente

### Entrega Completada
1. Conductor completa entrega → `completeDelivery`
2. Se actualiza `assignments` con tiempos reales
3. Se actualiza `orders` a "delivered"
4. Se incrementa contador de entregas del conductor
5. Conductor vuelve a estado "available"
6. Si es efectivo, se crea transacción automática
7. Todos los módulos se actualizan en tiempo real

### Conciliación
1. Finanzas crea conciliación → `createReconciliation`
2. Se calculan automáticamente totales del día
3. Se crean registros en `reconciliations`
4. Se actualizan estados de `transactions` a "reconciled"
5. Se actualizan estados de `driver_advances` a "deducted"
6. El módulo de finanzas refleja cambios instantáneamente

## Beneficios

1. **Integridad de Datos**: Las operaciones son atómicas y consistentes
2. **Trazabilidad**: Todos los cambios quedan registrados en `order_events`
3. **Sincronización Automática**: Los cambios se reflejan en todos los módulos inmediatamente
4. **Reducción de Errores**: Validación centralizada y operaciones transaccionales
5. **Mejor UX**: Los usuarios ven cambios en tiempo real sin recargar
6. **Mantenibilidad**: Lógica centralizada en lugar de duplicada
7. **Auditoría**: Historial completo de eventos para cada pedido

## Próximos Pasos Recomendados

1. Agregar manejo de errores con rollback automático
2. Implementar retry logic para operaciones fallidas
3. Agregar logs detallados para debugging
4. Crear dashboard de monitoreo de sincronización
5. Implementar notificaciones push para eventos críticos
6. Agregar tests unitarios para funciones de sincronización
