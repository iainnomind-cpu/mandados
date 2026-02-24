/*
  # Driver Remittances Table for Financial Reconciliation

  1. New Tables
    - `driver_remittances`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, references drivers)
      - `period_date` (date)
      - `total_collected` (numeric) - Dinero cobrado a clientes
      - `total_advances` (numeric) - Dinero adelantado por el repartidor
      - `driver_commissions` (numeric) - Ganancias del repartidor
      - `net_remittance_due` (numeric) - Monto a entregar a la empresa
      - `status` (varchar) - 'pending', 'paid_to_company'
      - `created_at` (timestamptz)

  2. Alterations
    - Add `payment_method` to `cod_transactions` if not exists.

  3. Security
    - Enable RLS on `driver_remittances` table
    - Add policies for finance team and drivers
*/

-- Modify cod_transactions to include payment_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cod_transactions' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE cod_transactions ADD COLUMN payment_method varchar DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'card'));
  END IF;
END $$;


CREATE TABLE IF NOT EXISTS driver_remittances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) NOT NULL,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  total_collected numeric(10,2) DEFAULT 0,
  total_advances numeric(10,2) DEFAULT 0,
  driver_commissions numeric(10,2) DEFAULT 0,
  net_remittance_due numeric(10,2) DEFAULT 0,
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'paid_to_company')),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_remittances_driver_id ON driver_remittances(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_remittances_period_date ON driver_remittances(period_date);
CREATE INDEX IF NOT EXISTS idx_driver_remittances_status ON driver_remittances(status);

-- Enable RLS
ALTER TABLE driver_remittances ENABLE ROW LEVEL SECURITY;

-- Policies

-- Finance and admins have full access
CREATE POLICY "Finance and admins can manage driver_remittances"
  ON driver_remittances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

-- Drivers can see their own remittances
CREATE POLICY "Drivers can view their own driver_remittances"
  ON driver_remittances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_remittances.driver_id
      AND drivers.user_id = auth.uid()
    )
  );
