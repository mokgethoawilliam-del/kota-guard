-- Kota Guard Phase 5.5: Pre-Orders & Loyalty
-- Run this in your Supabase SQL Editor.

-- Add pre-order collection estimated time
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='estimated_collection_time') THEN 
        ALTER TABLE public.orders ADD COLUMN estimated_collection_time TIME; 
    END IF; 
END $$;

-- Add customer arrival notification
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='orders' AND column_name='customer_arrived') THEN 
        ALTER TABLE public.orders ADD COLUMN customer_arrived BOOLEAN DEFAULT false; 
    END IF; 
END $$;
