const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function forceLinkMigration() {
    console.log(" Starting FORCE-LINK Migration...");

    // 1. PULL EVERYTHING FROM OLD
    const { data: vendors } = await oldSupabase.from('vendors').select('*').ilike('name', '%Fabri%');
    const { data: menu } = await oldSupabase.from('menu_items').select('*');
    const { data: locs } = await oldSupabase.from('locations').select('*');

    if (!vendors || vendors.length === 0) {
        console.error("Critical: Could not find vendor in old project.");
        return;
    }

    const realVendor = vendors[0];
    console.log(`Found Real Vendor: ${realVendor.name} (${realVendor.id})`);

    // 2. INSERT VENDOR FIRST
    console.log("Step 1: Creating Parent Vendor...");
    const { error: vErr } = await newSupabase.from('vendors').upsert({
        id: realVendor.id,
        name: realVendor.name,
        slug: 'fabris-eaters',
        branding: realVendor.branding,
        settings: realVendor.settings
    });
    
    if (vErr) {
        console.error("Failed to create parent vendor:", vErr.message);
        return;
    }
    console.log(" Parent Vendor Created.");

    // 3. INSERT MENU ITEMS
    if (menu) {
        console.log(`Step 2: Linking ${menu.length} menu items...`);
        // Filter out any items that don't belong to this vendor (if multi-vendor in old)
        const myMenu = menu.filter(m => m.vendor_id === realVendor.id).map(m => {
            const clean = {...m};
            delete clean.is_active; // Mismatch column
            return clean;
        });

        const { error: mErr } = await newSupabase.from('menu_items').upsert(myMenu);
        if (mErr) console.error("Menu link error:", mErr.message);
        else console.log(` ${myMenu.length} items linked successfully.`);
    }

    // 4. INSERT LOCATIONS
    if (locs) {
        console.log(`Step 3: Linking ${locs.length} locations...`);
        const myLocs = locs.filter(l => l.vendor_id === realVendor.id).map(l => {
            const clean = {...l};
            delete clean.banner_text; // Mismatch column
            return clean;
        });
        const { error: lErr } = await newSupabase.from('locations').upsert(myLocs);
        if (lErr) console.error("Location link error:", lErr.message);
        else console.log(" Locations linked successfully.");
    }

    console.log(" FORCE-LINK COMPLETE! Your storefront is now alive.");
}

forceLinkMigration();
