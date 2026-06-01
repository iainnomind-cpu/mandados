-- ============================================================================
-- LIMPIAR DATOS DE PRUEBA — Solo borra filas, NO toca estructura ni políticas
-- Orden: hijos primero → padres después (respeta FK)
-- NO toca: profiles (tu usuario admin), system_settings (config del bot)
-- ============================================================================

BEGIN;

-- 1. Tablas hijas sin dependientes (nivel más bajo)
DELETE FROM route_stops;
DELETE FROM cod_transactions;
DELETE FROM driver_remittances;
DELETE FROM order_items;
DELETE FROM order_events;
DELETE FROM driver_locations;
DELETE FROM driver_advances;

-- 2. Tablas intermedias
DELETE FROM assignments;
DELETE FROM transactions;
DELETE FROM reconciliations;
DELETE FROM driver_routes;

-- 3. Tablas principales de operación
DELETE FROM chat_messages;
DELETE FROM orders;
DELETE FROM routes;

-- 4. Conversaciones y clientes
DELETE FROM chat_conversations;
DELETE FROM customers;

-- 5. Flotilla (conductores) — se borran los repartidores de prueba
DELETE FROM drivers;

-- 6. Zonas de entrega (datos obsoletos)
DELETE FROM delivery_zones;

-- ⚠️ NO tocamos estas tablas:
-- • profiles     → Tu usuario Admin vive aquí, borrarlo te deja sin acceso
-- • system_settings → Configuración del bot/horarios

COMMIT;

-- Verificación rápida: conteo de filas después de la limpieza
SELECT 'orders' AS tabla, COUNT(*) AS filas FROM orders
UNION ALL SELECT 'drivers', COUNT(*) FROM drivers
UNION ALL SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'chat_conversations', COUNT(*) FROM chat_conversations
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'cod_transactions', COUNT(*) FROM cod_transactions
UNION ALL SELECT 'driver_remittances', COUNT(*) FROM driver_remittances
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'system_settings', COUNT(*) FROM system_settings;
