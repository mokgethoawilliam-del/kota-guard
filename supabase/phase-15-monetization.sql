-- Phase 15: Monetization & Billing Layer
-- Adds subscription tracking to vendors table

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'; -- trial, active, past_due, cancelled
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS monthly_rate NUMERIC(10, 2) DEFAULT 399.00;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS setup_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS setup_fee_rate NUMERIC(10, 2) DEFAULT 2500.00;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS last_billing_date TIMESTAMPTZ;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;
