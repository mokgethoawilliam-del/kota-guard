-- 1. IDENTIFY THE TRUE VENDOR ID
-- We look for the vendor that has actual menu items linked to it.
DO $$
DECLARE
    true_vendor_id UUID;
    empty_vendor_id UUID;
BEGIN
    -- Find the vendor that has actual data (menu items)
    SELECT vendor_id INTO true_vendor_id 
    FROM public.kg_menu_items 
    GROUP BY vendor_id 
    ORDER BY count(*) DESC 
    LIMIT 1;

    -- Find the empty duplicate shell I created earlier (the one with the slug)
    SELECT id INTO empty_vendor_id 
    FROM public.kg_vendors 
    WHERE slug = 'fabris-eaters' 
    AND id != true_vendor_id;

    -- If we found both, perform the transfer
    IF true_vendor_id IS NOT NULL AND empty_vendor_id IS NOT NULL THEN
        -- Move the slug to the "True" vendor
        UPDATE public.kg_vendors 
        SET slug = 'fabris-eaters' 
        WHERE id = true_vendor_id;
        
        -- Delete the empty shell
        DELETE FROM public.kg_vendors WHERE id = empty_vendor_id;
        
        RAISE NOTICE 'Vendor data unified under ID: %', true_vendor_id;
    ELSE
        -- Fallback: Just ensure the one with items has the slug
        UPDATE public.kg_vendors 
        SET slug = 'fabris-eaters' 
        WHERE id = true_vendor_id;
    END IF;
END $$;

-- 2. REFRESH API CACHE
NOTIFY pgrst, 'reload schema';
