-- ============================================================
-- KOTA GUARD: FINAL SYSTEM RESTORATION MIGRATION
-- Project: Shared Supabase Merge
-- Goal: Restore WhatsApp, Inventory, and Payment Finalization
-- ============================================================

-- 1. Create Bot Sessions (Missing from Master Migration)
CREATE TABLE IF NOT EXISTS public.kg_bot_sessions (
    phone_number TEXT PRIMARY KEY,
    vendor_id UUID REFERENCES public.kg_vendors(id) ON DELETE CASCADE,
    state TEXT DEFAULT 'IDLE',
    last_order_id UUID REFERENCES public.kg_orders(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Bot Sessions
ALTER TABLE public.kg_bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public handle bot sessions" ON public.kg_bot_sessions FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Update Ingredients Schema (Add Missing Stock Columns)
ALTER TABLE public.kg_ingredients 
ADD COLUMN IF NOT EXISTS current_stock NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10, 2) DEFAULT 10.00;

-- 3. Fix Orders RLS (Enable Public Updates for Finalization)
-- Needed so the frontend can update internal order status and refs after payment.

DROP POLICY IF EXISTS "Public select own orders" ON public.kg_orders;
CREATE POLICY "Public select own orders" 
ON public.kg_orders FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Public update own orders" ON public.kg_orders;
CREATE POLICY "Public update own orders" 
ON public.kg_orders FOR UPDATE 
USING (status = 'pending')
WITH CHECK (status IN ('pending', 'paid', 'preparing'));

-- 4. Enable Public Read for Order Items (Needed for status checks)
DROP POLICY IF EXISTS "Public select order items" ON public.kg_order_items;
CREATE POLICY "Public select order items" 
ON public.kg_order_items FOR SELECT 
USING (true);

-- 5. Vendor Management (Safety Check)
DROP POLICY IF EXISTS "Vendors manage orders" ON public.kg_orders;
CREATE POLICY "Vendors manage orders" 
ON public.kg_orders FOR ALL 
TO authenticated 
USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
