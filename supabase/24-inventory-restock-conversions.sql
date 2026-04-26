-- ============================================================
-- Inventory restock conversions
-- Lets vendors restock in bulk units like kg while tracking
-- plain usable stock counts for recipes and deductions.
-- Example: 2 kg polony -> 20 usable counts
-- ============================================================

ALTER TABLE public.ingredients
ADD COLUMN IF NOT EXISTS restock_input_label TEXT,
ADD COLUMN IF NOT EXISTS restock_input_quantity NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS restock_output_quantity NUMERIC(10, 2);

NOTIFY pgrst, 'reload schema';
