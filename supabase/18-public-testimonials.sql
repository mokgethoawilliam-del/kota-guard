-- VulaHub Phase 18: Public Testimonials
-- Allow public visitors to submit reviews (defaulting to hidden state for moderation)

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can insert testimonials" ON public.testimonials;
    
    CREATE POLICY "Public can insert testimonials" ON public.testimonials
        FOR INSERT 
        WITH CHECK (is_active = false);
END $$;
