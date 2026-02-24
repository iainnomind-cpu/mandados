/*
  # COD Transactions Module

  1. New Tables
    - `cod_transactions`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `driver_id` (uuid, references drivers)
      - `transaction_type` (varchar) - 'anticipo', 'cobro_cliente', 'liquidacion'
      - `amount` (numeric)
      - `status` (varchar) - 'pending', 'reconciled'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `cod_transactions` table
    - Add policies for finance team and drivers
*/

CREATE TABLE IF NOT EXISTS cod_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) NOT NULL,
  driver_id uuid REFERENCES drivers(id) NOT NULL,
  transaction_type varchar NOT NULL CHECK (transaction_type IN ('anticipo', 'cobro_cliente', 'liquidacion')),
  amount numeric(10,2) NOT NULL,
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled')),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cod_transactions_order_id ON cod_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_cod_transactions_driver_id ON cod_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_cod_transactions_status ON cod_transactions(status);
CREATE INDEX IF NOT EXISTS idx_cod_transactions_type ON cod_transactions(transaction_type);

-- Enable RLS
ALTER TABLE cod_transactions ENABLE ROW LEVEL SECURITY;

-- Policies

-- Finance and admins have full access
CREATE POLICY "Finance and admins can manage cod_transactions"
  ON cod_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'finance')
    )
  );

-- Drivers can see their own transactions
CREATE POLICY "Drivers can view their own cod_transactions"
  ON cod_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = cod_transactions.driver_id
      AND drivers.user_id = auth.uid()
    )
  );

-- Drivers can insert 'anticipo' and 'cobro_cliente'
CREATE POLICY "Drivers can insert anticipos and cobros"
  ON cod_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_id
      AND drivers.user_id = auth.uid()
    )
    AND transaction_type IN ('anticipo', 'cobro_cliente')
  );
