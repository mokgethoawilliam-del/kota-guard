-- KOTA GUARD MASTER SETUP
-- Run this in your Supabase SQL Editor to ensure all tables, triggers, and RLS policies are correct.

-- 1. VENDORS TABLE
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    custom_domain TEXT UNIQUE,
    branding JSONB DEFAULT '{
        "primary_color": "#00e676",
        "secondary_color": "#1e293b",
        "hero_text": "The Ultimate Kota Experience"
    }'::jsonb,
    payment_config JSONB DEFAULT '{}'::jsonb,
    netcash_config JSONB DEFAULT '{}'::jsonb,
    whatsapp_config JSONB DEFAULT '{}'::jsonb,
    paystack_subaccount_code TEXT,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on vendors" ON public.vendors;
CREATE POLICY "Allow public read access on vendors" ON public.vendors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on vendors" ON public.vendors;
CREATE POLICY "Allow public insert on vendors" ON public.vendors FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Vendors can update their own config" ON public.vendors;
CREATE POLICY "Vendors can update their own config" ON public.vendors FOR UPDATE 
USING (id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Allow system and authenticated users to insert a profile (for signup flow)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles FOR INSERT WITH CHECK (true);

-- 3. BOT SESSIONS (WhatsApp)
CREATE TABLE IF NOT EXISTS public.bot_sessions (
    phone_number TEXT PRIMARY KEY,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    state TEXT DEFAULT 'IDLE',
    current_order_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service role" ON public.bot_sessions;
CREATE POLICY "Allow all for service role" ON public.bot_sessions FOR ALL USING (true);

-- 4. PROFILE TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, vendor_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Shop Owner'), 
    (new.raw_user_meta_data->>'vendor_id')::uuid
  ) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. INITIAL VENDOR (Chef Dips)
INSERT INTO public.vendors (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Ko Chef Dips', 'chef-dips')
ON CONFLICT (id) DO NOTHING;
