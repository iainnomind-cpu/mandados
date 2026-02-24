/*
  # Fix TMS RLS Policies
  
  Updates the RLS policies for `driver_routes` and `route_stops` 
  to include the `operator` role, so they can create and manage assignments.
*/

-- Drop old policies
DROP POLICY IF EXISTS "Staff full access to driver_routes" ON driver_routes;
DROP POLICY IF EXISTS "Staff full access to route_stops" ON route_stops;

-- Recreate policies with 'operator' included
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
