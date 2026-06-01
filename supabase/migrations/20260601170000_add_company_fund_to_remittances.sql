/*
  # Add company_fund column to driver_remittances

  Adds an optional `company_fund` field to track when the company
  provides purchase funds to the delivery driver. Defaults to 0
  (meaning the driver used their own money).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_remittances' AND column_name = 'company_fund'
  ) THEN
    ALTER TABLE driver_remittances
      ADD COLUMN company_fund numeric(10,2) DEFAULT 0;
  END IF;
END $$;
