/*
  # TMS/DMS — Dispatch & Routing Tables

  ## Changes
  1. Extend `drivers` with `active_load_count`, `current_lat`, `current_lng`
  2. Create `driver_routes` table (per-driver daily route)
  3. Create `route_stops` table (individual stops per route, linked to orders)

  ## Security
  - Admin/Dispatcher: full access
  - Driver: can only view/update their own route & stops
*/

-- ============================================================
-- 1. Extend drivers table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'active_load_count'
  ) THEN
    ALTER TABLE drivers ADD COLUMN active_load_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'current_lat'
  ) THEN
    ALTER TABLE drivers ADD COLUMN current_lat numeric(10,8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'current_lng'
  ) THEN
    ALTER TABLE drivers ADD COLUMN current_lng numeric(11,8);
  END IF;
END $$;

-- ============================================================
-- 2. driver_routes table
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_routes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  route_date   date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (driver_id, route_date)   -- one route per driver per day
);

CREATE INDEX IF NOT EXISTS idx_driver_routes_driver_id  ON driver_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_routes_route_date ON driver_routes(route_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_routes_status     ON driver_routes(status);

-- ============================================================
-- 3. route_stops table
-- ============================================================
CREATE TABLE IF NOT EXISTS route_stops (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id           uuid NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
  order_id           uuid NOT NULL REFERENCES orders(id)       ON DELETE CASCADE,
  stop_sequence      integer NOT NULL DEFAULT 1,
  estimated_arrival  timestamptz,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reached', 'completed')),
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_id  ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id  ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_status    ON route_stops(status);

-- ============================================================
-- 4. Enable RLS
-- ============================================================
ALTER TABLE driver_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS — driver_routes
-- ============================================================

-- Admin / Dispatcher: full access
CREATE POLICY "Staff full access to driver_routes"
  ON driver_routes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'dispatcher')
    )
  );

-- Driver: view own routes only
CREATE POLICY "Drivers can view own routes"
  ON driver_routes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_routes.driver_id
        AND drivers.user_id = auth.uid()
    )
  );

-- Driver: update own route (e.g. mark completed)
CREATE POLICY "Drivers can update own routes"
  ON driver_routes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_routes.driver_id
        AND drivers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_routes.driver_id
        AND drivers.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. RLS — route_stops
-- ============================================================

-- Admin / Dispatcher: full access
CREATE POLICY "Staff full access to route_stops"
  ON route_stops FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'dispatcher')
    )
  );

-- Driver: view stops for their own routes
CREATE POLICY "Drivers can view own route stops"
  ON route_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_routes dr
      JOIN drivers d ON d.id = dr.driver_id
      WHERE dr.id = route_stops.route_id
        AND d.user_id = auth.uid()
    )
  );

-- Driver: update stop status (reached / completed)
CREATE POLICY "Drivers can update own route stops"
  ON route_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_routes dr
      JOIN drivers d ON d.id = dr.driver_id
      WHERE dr.id = route_stops.route_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM driver_routes dr
      JOIN drivers d ON d.id = dr.driver_id
      WHERE dr.id = route_stops.route_id
        AND d.user_id = auth.uid()
    )
  );
