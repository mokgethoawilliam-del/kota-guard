-- Add recipe_json column to menu_items to store ingredient mappings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='menu_items' AND column_name='recipe_json') THEN 
        ALTER TABLE public.menu_items ADD COLUMN recipe_json JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Explicitly allow public full access to ingredients so the KDS can deduct stock
ALTER TABLE IF EXISTS public.ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on ingredients" ON public.ingredients;
CREATE POLICY "Allow public all on ingredients"
ON public.ingredients FOR ALL TO public USING (true) WITH CHECK (true);
