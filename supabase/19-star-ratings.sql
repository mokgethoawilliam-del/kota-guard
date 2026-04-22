-- VulaHub Phase 19: Star Ratings
-- Adds star ratings to testimonials and allows empty quotes for quick reviews.

DO $$ 
BEGIN
    -- 1. Add rating column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='testimonials' AND column_name='rating') THEN 
        ALTER TABLE public.testimonials ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5) DEFAULT 5;
    END IF;

    -- 2. Make quote optional for users who just want to leave a star rating
    ALTER TABLE public.testimonials ALTER COLUMN quote DROP NOT NULL;
END $$;
