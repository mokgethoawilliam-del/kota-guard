-- ============================================================
-- Backfill branding.logo_url from vendors.logo_url
-- Ensures public storefronts can access the saved logo through
-- the branding JSON used by public_vendors.
-- ============================================================

UPDATE public.vendors
SET branding = COALESCE(branding, '{}'::jsonb)
    || jsonb_build_object('logo_url', logo_url)
WHERE logo_url IS NOT NULL
  AND (
    branding IS NULL
    OR branding->>'logo_url' IS NULL
    OR branding->>'logo_url' = ''
  );

NOTIFY pgrst, 'reload schema';
