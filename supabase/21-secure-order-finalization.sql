-- ============================================================
-- Secure order finalization
-- Browser clients must not be able to mark orders paid.
-- Payment finalization happens in finalize-order-payment Edge Function.
-- ============================================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Remove broad public update policies from MVP migrations.
DROP POLICY IF EXISTS "Public update own orders" ON public.orders;
DROP POLICY IF EXISTS "Public update arrival" ON public.orders;
DROP POLICY IF EXISTS "Allow public all on orders" ON public.orders;

-- Defense in depth: anonymous clients should not update orders directly.
REVOKE UPDATE ON TABLE public.orders FROM anon;

-- Narrow public arrival signal. This is intentionally limited to one field
-- and only works for orders already marked ready.
CREATE OR REPLACE FUNCTION public.mark_customer_arrived(p_order_number TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.orders
    SET customer_arrived = true
    WHERE order_number = p_order_number
      AND status = 'ready'
      AND customer_arrived IS DISTINCT FROM true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_customer_arrived(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_customer_arrived(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
