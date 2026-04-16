-- ============================================================
-- Kota Guard: Phase 16 - Customers & Testimonials
-- [SAFE]: Adds testimonials table.
-- ============================================================

-- 1. Create testimonials table
CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    quote TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- 3. Set up Policies

-- Public Read Access: For the Landing Pages
DROP POLICY IF EXISTS "Public read access on testimonials" ON public.testimonials;
CREATE POLICY "Public read access on testimonials" ON public.testimonials
    FOR SELECT USING (is_active = true);

-- Authenticated Vendor Access: Manage their own reviews
DROP POLICY IF EXISTS "Vendors can manage their own testimonials" ON public.testimonials;
CREATE POLICY "Vendors can manage their own testimonials" ON public.testimonials
    FOR ALL TO authenticated USING (vendor_id = (SELECT id FROM vendors WHERE owner_id = auth.uid()));
