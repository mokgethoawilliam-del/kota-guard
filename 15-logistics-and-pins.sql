-- 1. Locations: Add delivery configuration
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT false;

-- 2. Orders: Add security and logistics fields
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS collection_pin TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_method TEXT DEFAULT 'collection'; -- 'collection' | 'delivery'
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0;

-- 3. Update RLS (Ensure these are readable by public for tracking if needed, and venders for management)
-- These are already inherited from existing order/location policies, but let's confirm.
