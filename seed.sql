-- Seed Initial Locations for Chef Dips
INSERT INTO locations (name) VALUES 
('Lebowakgomo'),
('Seshego'),
('Mobile Stall')
ON CONFLICT (name) DO NOTHING;

-- Seed Chef Dips Menu Items
-- Base Kotas at R120. Modifiers (Pork vs Beef) will be handled in the frontend logic.
INSERT INTO menu_items (name, price, category) VALUES 
('Classic Kota (Pork)', 120.00, 'Main'),
('Classic Kota (Beef)', 120.00, 'Main'),
('Special Kota (Pork)', 150.00, 'Main'),
('Special Kota (Beef)', 150.00, 'Main');

-- Seed starting inventory for Lebowakgomo (just an example for scaling)
WITH l AS (SELECT id FROM locations WHERE name = 'Lebowakgomo' LIMIT 1)
INSERT INTO inventory (location_id, item_name, quantity, unit, reorder_level)
SELECT l.id, 'Standard Buns', 100, 'pieces', 20 FROM l
UNION ALL
SELECT l.id, 'Russians (Pork)', 50, 'pieces', 10 FROM l
UNION ALL
SELECT l.id, 'Atchaar', 5, 'kg', 1 FROM l;
