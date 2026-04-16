-- Fix RLS policies to allow dispatchers and operators to manage cod_transactions, assignments, and routes

DROP POLICY IF EXISTS "Finance and admins can manage cod_transactions" ON cod_transactions;
DROP POLICY IF EXISTS "Staff can manage cod_transactions" ON cod_transactions;
CREATE POLICY "Staff can manage cod_transactions"
  ON cod_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance', 'dispatcher', 'operator')
    )
  );

DROP POLICY IF EXISTS "Staff full access to driver_routes" ON driver_routes;
CREATE POLICY "Staff full access to driver_routes"
  ON driver_routes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );

DROP POLICY IF EXISTS "Staff full access to route_stops" ON route_stops;
CREATE POLICY "Staff full access to route_stops"
  ON route_stops FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );

DROP POLICY IF EXISTS "Dispatchers and admins can manage assignments" ON assignments;
DROP POLICY IF EXISTS "Staff can manage assignments" ON assignments;
CREATE POLICY "Staff can manage assignments"
  ON assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );

-- Fix RLS policies to allow dispatchers and operators to manage drivers table directly
DROP POLICY IF EXISTS "Admins can manage drivers" ON drivers;
DROP POLICY IF EXISTS "Staff can manage drivers directly" ON drivers;
CREATE POLICY "Staff can manage drivers directly"
  ON drivers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );

-- Fix RLS policies to allow dispatchers and operators to manage profiles table directly (for driver full names)
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can manage profiles directly" ON profiles;
CREATE POLICY "Staff can manage profiles directly"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );

-- Fix RLS policies for orders so dispatchers can mark them as delivered
DROP POLICY IF EXISTS "Operators and admins can manage orders" ON orders;
DROP POLICY IF EXISTS "Staff can manage orders directly" ON orders;
CREATE POLICY "Staff can manage orders directly"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );

-- Extend drivers table to store their name directly since we cannot create profiles without auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE drivers ADD COLUMN full_name text;
  END IF;
END $$;
