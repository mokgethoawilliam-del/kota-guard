-- ============================================================
-- MASTER CONSOLIDATION: Kota Guard -> Poultry Central Project
-- [SAFE]: All tables prefixed with 'kg_' to avoid collisions.
-- Project: https://ofizmorcfmkttuksdyhq.supabase.co
-- ============================================================

-- 1. Vendors (The Root Tenants for Kota Guard)
CREATE TABLE IF NOT EXISTS public.kg_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    custom_domain TEXT UNIQUE,
    branding JSONB DEFAULT '{
        "primary_color": "#00e676",
        "secondary_color": "#1e293b",
        "tagline": "Premium Kota Experience",
        "hero_title": "Nothing brings people together like good quality food.",
        "hero_subtitle": "Eskort Or Nothing. Kel Rata Zwap."
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    subscription_status TEXT DEFAULT 'trial',
    monthly_rate NUMERIC(10, 2) DEFAULT 399.00,
    setup_fee_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.1 Profiles (Links Auth User to Vendor)
CREATE TABLE IF NOT EXISTS public.kg_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT DEFAULT 'owner',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Locations
CREATE TABLE IF NOT EXISTS public.kg_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    google_maps_url TEXT,
    is_mobile BOOLEAN DEFAULT false,
    stall_date DATE,
    is_active BOOLEAN DEFAULT true,
    delivery_enabled BOOLEAN DEFAULT false,
    delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ingredients
CREATE TABLE IF NOT EXISTS public.kg_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT DEFAULT 'pcs',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Menu Items
CREATE TABLE IF NOT EXISTS public.kg_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT DEFAULT 'Kotas',
    image_url TEXT,
    ingredients JSONB DEFAULT '[]'::jsonb,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Orders
CREATE TABLE IF NOT EXISTS public.kg_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.kg_locations(id),
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, preparing, ready, completed, refunded
    payment_status TEXT DEFAULT 'pending',
    collection_pin TEXT NOT NULL,
    customer_arrived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Order Items
CREATE TABLE IF NOT EXISTS public.kg_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.kg_orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.kg_menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Expenses
CREATE TABLE IF NOT EXISTS public.kg_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    receipt_url TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Support Chats
CREATE TABLE IF NOT EXISTS public.kg_support_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    session_identifier TEXT NOT NULL,
    sender_type TEXT NOT NULL, -- admin, customer
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Testimonials
CREATE TABLE IF NOT EXISTS public.kg_testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    quote TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Site Gallery
CREATE TABLE IF NOT EXISTS public.kg_site_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECURITY: RLS & POLICIES
-- ============================================================

ALTER TABLE public.kg_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_site_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kg_profiles ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ POLICIES
CREATE POLICY "Public read kg_vendors" ON public.kg_vendors FOR SELECT USING (true);
CREATE POLICY "Public read kg_locations" ON public.kg_locations FOR SELECT USING (is_active = true);
CREATE POLICY "Public read kg_menu_items" ON public.kg_menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Public read kg_testimonials" ON public.kg_testimonials FOR SELECT USING (is_active = true);
CREATE POLICY "Public read kg_site_gallery" ON public.kg_site_gallery FOR SELECT USING (true);

-- PUBLIC INSERT POLICIES (Customers)
CREATE POLICY "Public insert kg_orders" ON public.kg_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert kg_order_items" ON public.kg_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert kg_support_chats" ON public.kg_support_chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert kg_testimonials" ON public.kg_testimonials FOR INSERT WITH CHECK (true);

-- VENDOR MANAGER POLICIES (Authenticated Owners)
CREATE POLICY "Vendors manage own data" ON public.kg_vendors FOR ALL TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Users manage own profile" ON public.kg_profiles FOR ALL TO authenticated USING (id = auth.uid());
CREATE POLICY "Vendors manage locations" ON public.kg_locations FOR ALL TO authenticated USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
CREATE POLICY "Vendors manage menu" ON public.kg_menu_items FOR ALL TO authenticated USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
CREATE POLICY "Vendors manage orders" ON public.kg_orders FOR ALL TO authenticated USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
CREATE POLICY "Vendors manage order_items" ON public.kg_order_items FOR ALL TO authenticated USING (order_id IN (SELECT id FROM kg_orders WHERE vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid())));
CREATE POLICY "Vendors manage expenses" ON public.kg_expenses FOR ALL TO authenticated USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
CREATE POLICY "Vendors manage support" ON public.kg_support_chats FOR ALL TO authenticated USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
CREATE POLICY "Vendors manage testimonials" ON public.kg_testimonials FOR ALL TO authenticated USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
CREATE POLICY "Vendors manage gallery" ON public.kg_site_gallery FOR ALL TO authenticated USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
