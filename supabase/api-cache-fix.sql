-- 1. RELOAD API CACHE
-- This fixes the HTTP 406 "Not Acceptable" error by forcing PostgREST to refresh its table mappings.
NOTIFY pgrst, 'reload schema';

-- 2. RESTORE MISSING VENDOR 'fabris-eaters'
-- This ensures the landing page can load for this specific vendor.
INSERT INTO public.vendors (
    name, 
    slug, 
    branding
) 
VALUES (
    'Fabris Eaters', 
    'fabris-eaters', 
    '{
        "primary_color": "#ff9800",
        "secondary_color": "#0f172a",
        "tagline": "The Ultimate Kota Experience",
        "hero_title": "Fresh. Hot. Delicious.",
        "welcome_text": "Dumelang chommi tsaka"
    }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    branding = EXCLUDED.branding;

-- 3. ENSURE PUBLIC SELECT IS ACTIVE
-- Double-check that the public can read the vendor table.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'vendors' AND policyname = 'Public read vendors'
    ) THEN
        CREATE POLICY "Public read vendors" ON public.vendors FOR SELECT USING (true);
    END IF;
END $$;
