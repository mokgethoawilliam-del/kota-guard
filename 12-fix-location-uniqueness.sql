-- VulaHub Phase 11 Cleanup: Fix Location Uniqueness
-- Branch names should be unique PER VENDOR, not globally.

-- 1. Drop the global unique constraint if it exists
ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_name_key;

-- 2. Add a composite unique constraint for (vendor_id, name)
-- This ensures that Vendor A can have a "Main Shop" and Vendor B can ALSO have a "Main Shop".
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_vendor_location_name') THEN 
        ALTER TABLE public.locations ADD CONSTRAINT uniq_vendor_location_name UNIQUE (vendor_id, name);
    END IF; 
END $$;
