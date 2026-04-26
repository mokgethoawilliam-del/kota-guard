-- ============================================================
-- Role-based access hardening
-- Splits owner/admin access from inventory staff access.
-- Inventory staff should not inherit full vendor-wide CRUD rights.
-- ============================================================

-- Vendors -----------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage own data" ON public.vendors;
DROP POLICY IF EXISTS "Vendor owners can select own vendor" ON public.vendors;
DROP POLICY IF EXISTS "Vendor owners can update own vendor" ON public.vendors;
DROP POLICY IF EXISTS "Vendor owners can delete own vendor" ON public.vendors;

CREATE POLICY "Vendor admins can select own vendor"
ON public.vendors
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.vendors.id
          AND p.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Vendor admins can update own vendor"
ON public.vendors
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.vendors.id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.vendors.id
          AND p.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Vendor admins can delete own vendor"
ON public.vendors
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.vendors.id
          AND p.role IN ('owner', 'admin')
    )
);

-- Locations ---------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage locations" ON public.locations;

CREATE POLICY "Vendor team can read locations"
ON public.locations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.locations.vendor_id
          AND p.role IN ('owner', 'admin', 'inventory_staff')
    )
);

CREATE POLICY "Vendor admins manage locations"
ON public.locations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.locations.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.locations.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

-- Ingredients -------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage ingredients" ON public.ingredients;

CREATE POLICY "Vendor team can read ingredients"
ON public.ingredients
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.ingredients.vendor_id
          AND p.role IN ('owner', 'admin', 'inventory_staff')
    )
);

CREATE POLICY "Vendor admins manage ingredients"
ON public.ingredients
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.ingredients.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.ingredients.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

-- Menu items --------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage menu" ON public.menu_items;

CREATE POLICY "Vendor admins manage menu"
ON public.menu_items
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.menu_items.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.menu_items.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

-- Orders ------------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage orders" ON public.orders;

CREATE POLICY "Vendor admins manage orders"
ON public.orders
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.orders.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.orders.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

-- Order items -------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage order_items" ON public.order_items;

CREATE POLICY "Vendor admins manage order items"
ON public.order_items
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.orders o
        JOIN public.profiles p ON p.vendor_id = o.vendor_id
        WHERE p.id = auth.uid()
          AND p.role IN ('owner', 'admin')
          AND o.id = public.order_items.order_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.orders o
        JOIN public.profiles p ON p.vendor_id = o.vendor_id
        WHERE p.id = auth.uid()
          AND p.role IN ('owner', 'admin')
          AND o.id = public.order_items.order_id
    )
);

-- Expenses ----------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage expenses" ON public.expenses;

CREATE POLICY "Vendor admins manage expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.expenses.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.expenses.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

-- Support chats -----------------------------------------------
DROP POLICY IF EXISTS "Vendors manage support" ON public.support_chats;

CREATE POLICY "Vendor admins manage support chats"
ON public.support_chats
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.support_chats.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.support_chats.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

-- Testimonials ------------------------------------------------
DROP POLICY IF EXISTS "Vendors manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Vendors can manage their own testimonials" ON public.testimonials;

CREATE POLICY "Vendor admins manage testimonials"
ON public.testimonials
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.testimonials.vendor_id
          AND p.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.testimonials.vendor_id
          AND p.role IN ('owner', 'admin')
    )
);

-- Inventory adjustment audit log ------------------------------
DROP POLICY IF EXISTS "Vendors manage inventory adjustments" ON public.inventory_adjustments;

CREATE POLICY "Vendor team can read inventory adjustments"
ON public.inventory_adjustments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.vendor_id = public.inventory_adjustments.vendor_id
          AND p.role IN ('owner', 'admin', 'inventory_staff')
    )
);

NOTIFY pgrst, 'reload schema';
