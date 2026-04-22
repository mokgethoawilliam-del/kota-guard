-- 1. IDENTIFY THE TRUE VENDOR ID
-- We look for the vendor that has actual menu items linked to it.
DO $$
DECLARE
    true_vendor_id UUID;
    empty_vendor_id UUID;
BEGIN
    -- Find the vendor that has actual data (menu items)
    SELECT vendor_id INTO true_vendor_id 
    FROM public.menu_items 
    GROUP BY vendor_id 
    ORDER BY count(*) DESC 
    LIMIT 1;

    -- Find the empty duplicate shell I created earlier (the one with the slug)
    SELECT id INTO empty_vendor_id 
    FROM public.vendors 
    WHERE slug = 'fabris-eaters' 
    AND id != true_vendor_id;

    -- If we found both, perform the transfer
    IF true_vendor_id IS NOT NULL AND empty_vendor_id IS NOT NULL THEN
        -- Temporarily rename the empty shell's slug to avoid the UNIQUE constraint error
        UPDATE public.vendors 
        SET slug = 'fabris-eaters-old' 
        WHERE id = empty_vendor_id;

        -- Now safely move the slug to the "True" vendor
        UPDATE public.vendors 
        SET slug = 'fabris-eaters' 
        WHERE id = true_vendor_id;
        -- Fix FK constraint on Orders pointing to duplicate locations before deletion
        UPDATE public.orders o
        SET location_id = t_loc.id
        FROM public.locations e_loc, public.locations t_loc
        WHERE o.location_id = e_loc.id
          AND e_loc.vendor_id = empty_vendor_id
          AND t_loc.vendor_id = true_vendor_id
          AND e_loc.name = t_loc.name;
        
        -- Prevent UNIQUE constraint error on locations by deleting duplicates first
        DELETE FROM public.locations 
        WHERE vendor_id = empty_vendor_id 
        AND name IN (SELECT name FROM public.locations WHERE vendor_id = true_vendor_id);
        
        -- Now move remaining safe locations
        UPDATE public.locations SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        
        UPDATE public.profiles SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        UPDATE public.orders SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        
        -- Master Sweep: Transfer everything safely to prevent any further FK constraint violations
        BEGIN
            DELETE FROM public.menu_items WHERE vendor_id = empty_vendor_id AND name IN (SELECT name FROM public.menu_items WHERE vendor_id = true_vendor_id);
            UPDATE public.menu_items SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        EXCEPTION WHEN OTHERS THEN END;
        
        BEGIN
            DELETE FROM public.ingredients WHERE vendor_id = empty_vendor_id AND name IN (SELECT name FROM public.ingredients WHERE vendor_id = true_vendor_id);
            UPDATE public.ingredients SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        EXCEPTION WHEN OTHERS THEN END;
        
        BEGIN
            DELETE FROM public.categories WHERE vendor_id = empty_vendor_id AND name IN (SELECT name FROM public.categories WHERE vendor_id = true_vendor_id);
            UPDATE public.categories SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        EXCEPTION WHEN OTHERS THEN END;
        
        BEGIN
            UPDATE public.expenses SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        EXCEPTION WHEN OTHERS THEN END;
        
        BEGIN
            UPDATE public.support_chats SET vendor_id = true_vendor_id WHERE vendor_id = empty_vendor_id;
        EXCEPTION WHEN OTHERS THEN END;
        
        -- Delete the empty shell now that ALL references are clear
        DELETE FROM public.vendors WHERE id = empty_vendor_id;
        
        RAISE NOTICE 'Vendor data unified under ID: %', true_vendor_id;
    ELSE
        -- Fallback: Just ensure the one with items has the slug
        UPDATE public.vendors 
        SET slug = 'fabris-eaters' 
        WHERE id = true_vendor_id;
    END IF;
END $$;

-- 2. REFRESH API CACHE
NOTIFY pgrst, 'reload schema';
