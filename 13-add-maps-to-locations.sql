-- VulaHub Phase 11: Maps & Addresses
-- Adding fields to store physical address and Google Maps links for branches.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='address') THEN 
        ALTER TABLE public.locations ADD COLUMN address TEXT; 
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='google_maps_url') THEN 
        ALTER TABLE public.locations ADD COLUMN google_maps_url TEXT; 
    END IF; 
END $$;
