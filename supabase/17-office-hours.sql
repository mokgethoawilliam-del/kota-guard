-- VulaHub Phase 17: Office Hours
-- Adding field to store office hours for branches.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='office_hours') THEN 
        ALTER TABLE public.locations ADD COLUMN office_hours TEXT; 
    END IF; 
END $$;
