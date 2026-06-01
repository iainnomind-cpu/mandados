-- Migration: Add INSERT policy for system_settings and ensure row exists
-- This fixes the PGRST116 error when the row doesn't exist

-- Add INSERT policy for authenticated users (needed for upsert)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'system_settings' 
    AND policyname = 'Allow authenticated insert access on system_settings'
  ) THEN
    CREATE POLICY "Allow authenticated insert access on system_settings"
      ON public.system_settings FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Ensure the default row exists
INSERT INTO public.system_settings (id, bot_paused_globally)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
