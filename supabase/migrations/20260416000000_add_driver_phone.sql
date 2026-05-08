-- Add phone column to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'phone'
  ) THEN
    ALTER TABLE drivers ADD COLUMN phone text;
  END IF;
END $$;
