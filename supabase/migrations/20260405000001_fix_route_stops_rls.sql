-- Fix RLS policies for route_stops and driver_routes
-- The FOR ALL policies were missing WITH CHECK, which causes INSERT to fail.

-- ─── Fix driver_routes ───
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );

-- ─── Fix route_stops ───
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'dispatcher', 'operator')
    )
  );
