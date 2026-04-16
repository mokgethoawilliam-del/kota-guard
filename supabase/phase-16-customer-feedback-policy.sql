-- ============================================================
-- Kota Guard: Phase 16 - Customer Feedback Policy
-- [SAFE]: Allows public to submit testimonials (hidden by default).
-- ============================================================

-- 1. Ensure is_active defaults to false for new submissions
ALTER TABLE public.testimonials ALTER COLUMN is_active SET DEFAULT false;

-- 2. Public Insert Access: Allow customers to submit reviews
DROP POLICY IF EXISTS "Public insert testimonials" ON public.testimonials;
CREATE POLICY "Public insert testimonials" ON public.testimonials
    FOR INSERT WITH CHECK (true);
