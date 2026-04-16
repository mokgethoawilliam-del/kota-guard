-- ============================================================
-- SCHEMA UPDATE: INGREDIENTS STOCK TRACKING
-- Adding missing columns to kg_ingredients as expected by 
-- the Admin Dashboard and inventory logic.
-- ============================================================

ALTER TABLE public.kg_ingredients 
ADD COLUMN IF NOT EXISTS current_stock NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10, 2) DEFAULT 10.00;

-- Ensure RLS is aware of these new columns for updates
-- (Policy from master migration should cover this, but here's a safety check)
DROP POLICY IF EXISTS "Vendors manage ingredients" ON public.kg_ingredients;
CREATE POLICY "Vendors manage ingredients" 
ON public.kg_ingredients FOR ALL 
TO authenticated 
USING (vendor_id IN (SELECT vendor_id FROM kg_profiles WHERE id = auth.uid()));
