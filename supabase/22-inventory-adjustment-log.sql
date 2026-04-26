-- ============================================================
-- Inventory adjustment audit log
-- Tracks manual and AI-assisted stock changes for accountability.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    operation TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    previous_stock NUMERIC(10, 2) NOT NULL,
    new_stock NUMERIC(10, 2) NOT NULL,
    note TEXT,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage inventory adjustments" ON public.inventory_adjustments;

CREATE POLICY "Vendors manage inventory adjustments"
ON public.inventory_adjustments
FOR ALL
TO authenticated
USING (
    vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
    vendor_id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid())
);

NOTIFY pgrst, 'reload schema';
