-- Fix RLS Policies for CMS Access
-- Since the application uses the anon key for both customers and admin (for this MVP), 
-- we need to grant full CRUD access to the menu_items and locations tables so the 
-- Admin Dashboard can actually save data without getting an RLS violation.

-- Enable full access for menu_items
DROP POLICY IF EXISTS "Allow public read access on menu_items" ON menu_items;
CREATE POLICY "Allow public all on menu_items"
ON menu_items FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable full access for locations (Stall Events Manager)
DROP POLICY IF EXISTS "Allow public read access on locations" ON locations;
CREATE POLICY "Allow public all on locations"
ON locations FOR ALL TO public USING (true) WITH CHECK (true);
