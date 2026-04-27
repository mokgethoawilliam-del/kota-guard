-- ============================================================
-- Chef Dips branding backfill
-- Preserves Chef Dips-specific landing copy as stored branding
-- instead of relying on global fallback defaults.
-- ============================================================

UPDATE public.vendors
SET branding = COALESCE(branding, '{}'::jsonb)
    || jsonb_build_object(
        'tagline', 'Signature Food Experience',
        'welcome_text', 'WEEEEC',
        'hero_title', 'Nothing brings people together like',
        'hero_highlight', 'good quality food.',
        'hero_subtitle', 'Eskort Or Nothing. Kel Rata Zwap.',
        'enable_reservations', false
    )
WHERE slug = 'chef-dips';

NOTIFY pgrst, 'reload schema';
