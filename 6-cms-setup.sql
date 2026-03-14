-- VulaHub Phase 11: CMS & Settings
-- Run this in your Supabase SQL Editor.

-- Add a custom banner text specifically for the Mobile Stall or general alerts
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='banner_text') THEN 
        ALTER TABLE public.locations ADD COLUMN banner_text TEXT; 
    END IF; 
END $$;

-- Add stall date and preorder deadline for the Mobile Stall
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='stall_date') THEN 
        ALTER TABLE public.locations ADD COLUMN stall_date TEXT; 
    END IF; 
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='preorder_deadline') THEN 
        ALTER TABLE public.locations ADD COLUMN preorder_deadline TEXT; 
    END IF; 
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='preorder_start_date') THEN 
        ALTER TABLE public.locations ADD COLUMN preorder_start_date TEXT; 
    END IF; 
END $$;

-- Add an active toggle so Chef Dips can visually close a location (like the Mobile Stall) on the landing page
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='is_active') THEN 
        ALTER TABLE public.locations ADD COLUMN is_active BOOLEAN DEFAULT true; 
    END IF; 
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='locations' AND column_name='is_mobile') THEN 
        ALTER TABLE public.locations ADD COLUMN is_mobile BOOLEAN DEFAULT false; 
    END IF; 
END $$;

-- Add an image URL to Menu Items so she can define her gallery dynamically
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='menu_items' AND column_name='image_url') THEN 
        ALTER TABLE public.menu_items ADD COLUMN image_url TEXT; 
    END IF; 
END $$;

-- Update the seed data to set the Mobile Stall banner placeholder and mark it as mobile
UPDATE public.locations 
SET banner_text = 'Check our Facebook for today''s drop location!', is_mobile = true 
WHERE name = 'Mobile Stall';
