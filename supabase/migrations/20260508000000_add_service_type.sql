-- Add service_type column to orders table
-- Values: 'sencillo' (commission $35) or 'complejo' (commission $45)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type TEXT
  CHECK (service_type IN ('sencillo', 'complejo'));

-- Add comment for documentation
COMMENT ON COLUMN orders.service_type IS 'Tipo de servicio: sencillo ($35) o complejo ($45). Determina la comisión automáticamente.';
COMMENT ON COLUMN orders.delivery_fee IS 'Comisión del servicio (antes tarifa de envío). Se calcula automáticamente según service_type.';
