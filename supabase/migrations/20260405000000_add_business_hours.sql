-- Migration: Add business hours configuration to system_settings
-- This allows configuring operating hours per day of the week for the WhatsApp bot.

ALTER TABLE public.system_settings 
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{
    "enabled": false,
    "timezone": "America/Mexico_City",
    "schedule": {
      "monday":    {"open": true, "start": "09:00", "end": "20:00"},
      "tuesday":   {"open": true, "start": "09:00", "end": "20:00"},
      "wednesday": {"open": true, "start": "09:00", "end": "20:00"},
      "thursday":  {"open": true, "start": "09:00", "end": "20:00"},
      "friday":    {"open": true, "start": "09:00", "end": "20:00"},
      "saturday":  {"open": true, "start": "09:00", "end": "14:00"},
      "sunday":    {"open": false, "start": "09:00", "end": "14:00"}
    }
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS outside_hours_message text DEFAULT '🕐 Gracias por escribirnos. En este momento nos encontramos fuera de nuestro horario de atención. ¡Te atenderemos con gusto en cuanto estemos de vuelta!';

-- Make sure the existing row has the new defaults
UPDATE public.system_settings 
SET 
  business_hours = COALESCE(business_hours, '{
    "enabled": false,
    "timezone": "America/Mexico_City",
    "schedule": {
      "monday":    {"open": true, "start": "09:00", "end": "20:00"},
      "tuesday":   {"open": true, "start": "09:00", "end": "20:00"},
      "wednesday": {"open": true, "start": "09:00", "end": "20:00"},
      "thursday":  {"open": true, "start": "09:00", "end": "20:00"},
      "friday":    {"open": true, "start": "09:00", "end": "20:00"},
      "saturday":  {"open": true, "start": "09:00", "end": "14:00"},
      "sunday":    {"open": false, "start": "09:00", "end": "14:00"}
    }
  }'::jsonb),
  outside_hours_message = COALESCE(outside_hours_message, '🕐 Gracias por escribirnos. En este momento nos encontramos fuera de nuestro horario de atención. ¡Te atenderemos con gusto en cuanto estemos de vuelta!')
WHERE id = 1;
