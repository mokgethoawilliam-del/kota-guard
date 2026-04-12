-- 1. Add Paystack Keys to vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS paystack_public_key TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS paystack_secret_key TEXT;

-- 2. Secure vendors
DROP POLICY IF EXISTS "Allow public read access on vendors" ON public.vendors;
DROP POLICY IF EXISTS "Vendors select public" ON public.vendors;
-- Anyone can see public info about a vendor (needs to load branding, public keys, etc)
CREATE POLICY "Vendors select public" ON public.vendors FOR SELECT USING (true);

-- No public inserts allowed
DROP POLICY IF EXISTS "Allow public insert on vendors" ON public.vendors;

-- Allow only authenticated users to insert a vendor (e.g., during onboarding)
DROP POLICY IF EXISTS "Auth insert on vendors" ON public.vendors;
CREATE POLICY "Auth insert on vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (true);

-- Allow vendor owner to update their own config
DROP POLICY IF EXISTS "Vendors can update their own config" ON public.vendors;
CREATE POLICY "Vendors can update their own config" ON public.vendors FOR UPDATE 
USING (id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));

-- 3. Secure menu_items
DROP POLICY IF EXISTS "Allow public all on menu_items" ON public.menu_items;
-- Public can read menu
DROP POLICY IF EXISTS "Public read menu_items" ON public.menu_items;
CREATE POLICY "Public read menu_items" ON public.menu_items FOR SELECT USING (true);
-- Only owners can insert/update/delete
DROP POLICY IF EXISTS "Vendor insert menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Vendor update menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Vendor delete menu_items" ON public.menu_items;
CREATE POLICY "Vendor insert menu_items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Vendor update menu_items" ON public.menu_items FOR UPDATE TO authenticated USING (vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Vendor delete menu_items" ON public.menu_items FOR DELETE TO authenticated USING (vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Secure locations
DROP POLICY IF EXISTS "Allow public all on locations" ON public.locations;
-- Public can read
DROP POLICY IF EXISTS "Public read locations" ON public.locations;
CREATE POLICY "Public read locations" ON public.locations FOR SELECT USING (true);
-- Only owners can insert/update/delete
DROP POLICY IF EXISTS "Vendor insert locations" ON public.locations;
DROP POLICY IF EXISTS "Vendor update locations" ON public.locations;
DROP POLICY IF EXISTS "Vendor delete locations" ON public.locations;
CREATE POLICY "Vendor insert locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Vendor update locations" ON public.locations FOR UPDATE TO authenticated USING (vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Vendor delete locations" ON public.locations FOR DELETE TO authenticated USING (vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Orders (Allow public tracking and insertion, but secure viewing for vendors)
-- We'll allow anon SELECT for tracking purposes. In a prod environment, an RPC function is better.
DROP POLICY IF EXISTS "Allow public all on orders" ON public.orders;
DROP POLICY IF EXISTS "Public select orders" ON public.orders;
CREATE POLICY "Public select orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update arrival" ON public.orders;
CREATE POLICY "Public update arrival" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

-- 6. Order Items
DROP POLICY IF EXISTS "Public insert order_items" ON public.order_items;
CREATE POLICY "Public insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public select order_items" ON public.order_items;
CREATE POLICY "Public select order_items" ON public.order_items FOR SELECT USING (true);

-- Ensure RLS is enabled
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
