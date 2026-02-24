/*
  # Orders Module Enhancement
  
  ## Changes
  1. Add `order_items` relational table
  2. Add `customer_name`, `customer_phone`, `assigned_driver_id` to orders
  
  These additions are backwards-compatible:
  - The existing JSONB `items` column is kept (not dropped)
  - New orders will populate `order_items` table
  - `customer_name`/`customer_phone` are additive; `customer_id` FK still exists
*/

-- Add new columns to orders table (safe with IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assigned_driver_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver_id ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);

-- Enable RLS on order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone authenticated can view order_items (mirrors orders policy)
CREATE POLICY "Authenticated users can view order_items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Admin, operator, dispatcher can manage order_items
CREATE POLICY "Staff can manage order_items"
  ON order_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operator', 'dispatcher')
    )
  );

-- RLS: Driver can view their own order items
CREATE POLICY "Drivers can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN drivers d ON d.id = o.assigned_driver_id
      WHERE o.id = order_items.order_id
        AND d.user_id = auth.uid()
    )
  );

-- Function to recalculate total_amount from order_items
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET total_amount = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update total_amount when items change
DROP TRIGGER IF EXISTS trg_order_items_total ON order_items;
CREATE TRIGGER trg_order_items_total
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
