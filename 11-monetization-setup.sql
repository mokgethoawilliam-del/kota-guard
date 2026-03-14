-- Add payment and plan configuration to vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS payment_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS netcash_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS paystack_subaccount_code TEXT;

-- 2. State management for WhatsApp Bot
CREATE TABLE IF NOT EXISTS public.bot_sessions (
    phone_number TEXT PRIMARY KEY,
    vendor_id UUID REFERENCES public.vendors(id),
    state TEXT DEFAULT 'IDLE',
    last_order_id UUID REFERENCES public.orders(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS doesn't block the bot (running as service_role)
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bot can manage all sessions" ON public.bot_sessions FOR ALL USING (true);

-- Update the existing Chef Dips vendor as a Growth plan
UPDATE public.vendors 
SET plan = 'growth', 
    payment_config = '{"use_platform_keys": true}'::jsonb
WHERE slug = 'chef-dips';
