-- fix-session-metadata.sql
-- This resolves the "Configuring your kitchen" stall issue.
-- It ensures that your user authentication metadata points to the unified True Vendor instead of the deleted shell.

DO $$
DECLARE
    true_vendor_id UUID;
    empty_vendor_id UUID; -- The one we deleted earlier, but is stuck in your session token
BEGIN
    -- 1. Find the True Vendor ID (the one we kept)
    SELECT id INTO true_vendor_id 
    FROM public.vendors 
    WHERE slug = 'fabris-eaters'
    LIMIT 1;

    -- 2. Force UPDATE the internal Supabase Auth metadata for all users who were tied to the deleted shell
    -- This updates the core identity token
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        raw_user_meta_data,
        '{vendor_id}',
        to_jsonb(true_vendor_id::text)
    )
    WHERE raw_user_meta_data->>'vendor_id' != true_vendor_id::text
       OR raw_user_meta_data->>'vendor_id' IS NULL;

    -- 3. THE MISSING LINK: If your physical 'profiles' row is pointing to a ghost vendor that no longer exists,
    -- it will never load the dashboard. We must rescue any orphaned profile.
    UPDATE public.profiles
    SET vendor_id = true_vendor_id
    WHERE vendor_id NOT IN (SELECT id FROM public.vendors);

    RAISE NOTICE 'Auth Identity and Profiles heavily mapped to True Vendor: %', true_vendor_id;
END $$;
