-- ============================================================
-- Reservations / venue bookings
-- Supports table bookings and venue reservations per vendor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    reservation_type TEXT NOT NULL DEFAULT 'table',
    status TEXT NOT NULL DEFAULT 'pending',
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    guest_count INTEGER NOT NULL DEFAULT 1,
    reservation_date DATE NOT NULL,
    reservation_time TEXT,
    occasion TEXT,
    special_requests TEXT,
    internal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reservations_type_check CHECK (reservation_type IN ('table', 'venue')),
    CONSTRAINT reservations_status_check CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled')),
    CONSTRAINT reservations_guest_count_check CHECK (guest_count > 0)
);

CREATE INDEX IF NOT EXISTS reservations_vendor_id_idx ON public.reservations(vendor_id);
CREATE INDEX IF NOT EXISTS reservations_vendor_date_idx ON public.reservations(vendor_id, reservation_date);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON public.reservations(status);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Vendor admins manage reservations" ON public.reservations;

CREATE POLICY "Public insert reservations"
ON public.reservations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Vendor admins manage reservations"
ON public.reservations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.reservations.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.reservations.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

CREATE OR REPLACE FUNCTION public.set_updated_at_reservations()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_reservations_updated_at ON public.reservations;
CREATE TRIGGER set_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_reservations();

NOTIFY pgrst, 'reload schema';
