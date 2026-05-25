-- Migration: Add 'problem' value to order_status enum
-- This enables the new driver feedback flow where they can report problems via WhatsApp buttons

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'problem';
