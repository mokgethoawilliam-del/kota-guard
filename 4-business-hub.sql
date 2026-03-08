-- Kota Guard Phase 8 & 9 Extensions: The Business Hub Schema
-- Run this in your Supabase SQL Editor.

-- ==========================================
-- PHASE 8: FINANCIAL EXPENSES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Safely add receipt_url if the user already ran the previous version of this file
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='expenses' AND column_name='receipt_url') THEN 
        ALTER TABLE public.expenses ADD COLUMN receipt_url TEXT; 
    END IF; 
END $$;


ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all actions for authenticated and anon users for now" ON public.expenses;
CREATE POLICY "Enable all actions for authenticated and anon users for now" ON public.expenses FOR ALL USING (true);

-- ==========================================
-- PHASE 9: LIVE INVENTORY TRACKING
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- e.g., 'rolls', 'slices', 'grams', 'liters'
    current_stock NUMERIC DEFAULT 0,
    low_stock_threshold NUMERIC DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable ALL for ingredients" ON public.ingredients;
CREATE POLICY "Enable ALL for ingredients" ON public.ingredients FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.menu_item_ingredients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity_required NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable ALL for recipe mapping" ON public.menu_item_ingredients;
CREATE POLICY "Enable ALL for recipe mapping" ON public.menu_item_ingredients FOR ALL USING (true);

-- Some starter seeding for ingredients so the dashboard isn't completely empty
INSERT INTO public.ingredients (name, unit, current_stock, low_stock_threshold) VALUES
('Kota Bread Rolls', 'rolls', 50, 20),
('Spelling Polony (Whole)', 'unit', 5, 2),
('Russian Sausages', 'units', 100, 30),
('Cheese Slices', 'slices', 80, 20),
('Potatoes (Chips)', 'kg', 50, 15)
ON CONFLICT DO NOTHING;

-- ==========================================
-- AUTO-DEDUCT TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION deduct_inventory_on_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct inventory when the kitchen starts preparing the order
    IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
        UPDATE public.ingredients i
        SET current_stock = i.current_stock - (mii.quantity_required * oi.quantity)
        FROM public.order_items oi
        JOIN public.menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
        WHERE oi.order_id = NEW.id AND i.id = mii.ingredient_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_inventory ON public.orders;
CREATE TRIGGER trg_deduct_inventory
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION deduct_inventory_on_order();

-- ==========================================
-- STORAGE BUCKETS (FOR RECEIPTS)
-- ==========================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('business-documents', 'business-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to receipts
DROP POLICY IF EXISTS "Public Receipt Access" ON storage.objects;
CREATE POLICY "Public Receipt Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'business-documents' );

-- Allow authenticated (and anon for MVPs) to insert receipts
DROP POLICY IF EXISTS "Allow Receipt Uploads" ON storage.objects;
CREATE POLICY "Allow Receipt Uploads" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'business-documents' );
