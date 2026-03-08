-- Enable Row Level Security (RLS) on the tables
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public/anon) to READ the locations
CREATE POLICY "Allow public read access on locations"
ON locations FOR SELECT TO public USING (true);

-- Allow anyone (public/anon) to READ the menu items
CREATE POLICY "Allow public read access on menu_items"
ON menu_items FOR SELECT TO public USING (true);

-- Allow anyone (public/anon) to INSERT a new pending order
CREATE POLICY "Allow public insert on orders"
ON orders FOR INSERT TO public WITH CHECK (true);

-- Allow anyone (public/anon) to READ AND UPDATE their own orders based on the anon session
-- (For MVP, we allow public read/update so the dashboard can see and modify them)
CREATE POLICY "Allow public read/update on orders"
ON orders FOR ALL TO public USING (true) WITH CHECK (true);

-- Allow anyone (public/anon) to INSERT and READ order items
CREATE POLICY "Allow public all on order_items"
ON order_items FOR ALL TO public USING (true) WITH CHECK (true);
