-- Migration to create system_settings table for global bot pause feature

CREATE TABLE IF NOT EXISTS public.system_settings (
    id integer PRIMARY KEY DEFAULT 1,
    bot_paused_globally boolean NOT NULL DEFAULT false,
    updated_at timestamptz DEFAULT now()
);

-- Ensure only one row exists (id must be 1)
ALTER TABLE public.system_settings ADD CONSTRAINT enforce_single_row CHECK (id = 1);

-- Insert the default single row if it doesn't exist
INSERT INTO public.system_settings (id, bot_paused_globally) 
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and update
CREATE POLICY "Allow authenticated read access on system_settings"
    ON public.system_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated update access on system_settings"
    ON public.system_settings FOR UPDATE
    TO authenticated
    USING (true);

-- Allow anon to read (webhook needs to check this)
CREATE POLICY "Allow anon read access on system_settings"
    ON public.system_settings FOR SELECT
    TO anon
    USING (true);
