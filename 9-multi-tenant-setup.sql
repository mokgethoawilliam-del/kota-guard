-- Kota Guard Phase: Multi-Tenant Expansion
-- Creating the Vendors table and migrating existing data to the "Default Vendor" (Chef Dips)

-- 1. Create the vendors table
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
    whatsapp_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert the first vendor (Chef Dips)
-- We use a fixed UUID here so we can easily link existing data in this script
INSERT INTO public.vendors (id, name, slug, branding)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Ko Chef Dips', 
    'chef-dips', 
    '{
        "primary_color": "#00e676",
        "secondary_color": "#1e293b",
        "hero_text": "Massive portions, premium ingredients, and that unmistakable South African flavor."
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 3. Add vendor_id to existing tables
-- We allow NULL initially, populate it, then make it NOT NULL

-- Table: locations
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);
UPDATE public.locations SET vendor_id = '11111111-1111-1111-1111-111111111111' WHERE vendor_id IS NULL;
-- ALTER TABLE public.locations ALTER COLUMN vendor_id SET NOT NULL;

-- Table: menu_items
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);
UPDATE public.menu_items SET vendor_id = '11111111-1111-1111-1111-111111111111' WHERE vendor_id IS NULL;
-- ALTER TABLE public.menu_items ALTER COLUMN vendor_id SET NOT NULL;

-- Table: orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);
UPDATE public.orders SET vendor_id = '11111111-1111-1111-1111-111111111111' WHERE vendor_id IS NULL;
-- ALTER TABLE public.orders ALTER COLUMN vendor_id SET NOT NULL;

-- Table: ingredients
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);
UPDATE public.ingredients SET vendor_id = '11111111-1111-1111-1111-111111111111' WHERE vendor_id IS NULL;
-- ALTER TABLE public.ingredients ALTER COLUMN vendor_id SET NOT NULL;

-- Table: expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);
UPDATE public.expenses SET vendor_id = '11111111-1111-1111-1111-111111111111' WHERE vendor_id IS NULL;
-- ALTER TABLE public.expenses ALTER COLUMN vendor_id SET NOT NULL;

-- 4. Set up Row Level Security (RLS) for the new vendors table
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on vendors" ON public.vendors;
CREATE POLICY "Allow public read access on vendors" ON public.vendors FOR SELECT USING (true);

-- 5. Update RLS on existing tables to ensure privacy between vendors
-- NOTE: For now, we are allowing public read for menus and locations (filtered by vendor_id in the app)
-- but in a production SaaS, we would eventually tie these to authenticated users.

-- Example for menu_items:
DROP POLICY IF EXISTS "Allow public all on menu_items" ON public.menu_items;
CREATE POLICY "Allow public all on menu_items" ON public.menu_items FOR ALL USING (true);
-- In a later phase, this will become: ... FOR ALL TO authenticated USING (vendor_id = auth.uid_vendor_id())
