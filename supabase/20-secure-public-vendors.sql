-- ============================================================
-- Secure public vendor reads
-- Public storefronts must never read vendor secret configuration
-- directly from public.vendors. Use public.public_vendors instead.
-- ============================================================

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Bring older live schemas up to the minimum public/private split shape.
-- These are safe no-ops when the columns already exist.
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS paystack_subaccount_code TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS paystack_public_key TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS paystack_secret_key TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS payment_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Remove broad public vendor reads from earlier MVP migrations.
DROP POLICY IF EXISTS "Public read vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow public read access on vendors" ON public.vendors;
DROP POLICY IF EXISTS "Vendors select public" ON public.vendors;

-- Anonymous clients should not be able to select from the real table.
REVOKE SELECT ON TABLE public.vendors FROM anon;

-- Authenticated owners can read and manage only their own vendor row.
DROP POLICY IF EXISTS "Vendors manage own data" ON public.vendors;
DROP POLICY IF EXISTS "Vendors can update their own config" ON public.vendors;
DROP POLICY IF EXISTS "Vendor owners can select own vendor" ON public.vendors;
DROP POLICY IF EXISTS "Vendor owners can update own vendor" ON public.vendors;
DROP POLICY IF EXISTS "Vendor owners can delete own vendor" ON public.vendors;

CREATE POLICY "Vendor owners can select own vendor"
ON public.vendors
FOR SELECT
TO authenticated
USING (
    owner_id = auth.uid()
    OR id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Vendor owners can update own vendor"
ON public.vendors
FOR UPDATE
TO authenticated
USING (
    owner_id = auth.uid()
    OR id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
    owner_id = auth.uid()
    OR id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Vendor owners can delete own vendor"
ON public.vendors
FOR DELETE
TO authenticated
USING (
    owner_id = auth.uid()
    OR id IN (SELECT vendor_id FROM public.profiles WHERE id = auth.uid())
);

-- Public-safe projection. Do not add secrets here.
CREATE OR REPLACE VIEW public.public_vendors AS
SELECT
    id,
    name,
    slug,
    custom_domain,
    branding,
    is_active,
    plan,
    paystack_subaccount_code,
    jsonb_strip_nulls(jsonb_build_object(
        'paystack_public_key', COALESCE(payment_config->>'paystack_public_key', paystack_public_key),
        'use_platform_keys', payment_config->'use_platform_keys'
    )) AS payment_config,
    created_at
FROM public.vendors
WHERE is_active = true;

GRANT SELECT ON public.public_vendors TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
