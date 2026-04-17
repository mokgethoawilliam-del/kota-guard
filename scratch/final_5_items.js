const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function absoluteFinalRestoration5Items() {
    console.log(" Starting FINAL 5-ITEM RESTORATION...");

    const trueVendorId = '1bef931b-e562-42cb-8838-a3240102ed6f';

    // 1. Fetch EVERYTHING from old (ignoring filters)
    const { data: menu } = await oldSupabase.from('menu_items').select('*');
    const { data: locs } = await oldSupabase.from('locations').select('*');
    const { data: ings } = await oldSupabase.from('ingredients').select('*');

    console.log(`Pulling ${menu.length} menu items, ${locs.length} locations, and ${ings.length} inventory items.`);

    // 2. Clear Target to avoid FK/Unique errors
    await newSupabase.from('menu_items').delete().eq('vendor_id', trueVendorId);
    await newSupabase.from('locations').delete().eq('vendor_id', trueVendorId);
    await newSupabase.from('ingredients').delete().eq('vendor_id', trueVendorId);

    // 3. Push to Target
    if (menu) {
        await newSupabase.from('menu_items').upsert(menu.map(m => {
            const clean = {...m, vendor_id: trueVendorId};
            delete clean.is_active;
            return clean;
        }));
    }

    if (locs) {
        await newSupabase.from('locations').upsert(locs.map(l => {
            const clean = {...l, vendor_id: trueVendorId};
            delete clean.banner_text;
            return clean;
        }));
    }

    if (ings) {
        await newSupabase.from('ingredients').upsert(ings.map(i => {
            const clean = {...i, vendor_id: trueVendorId};
            return clean;
        }));
    }

    console.log(" THE 5 ITEMS ARE MOVE COMPLETE!");
}

absoluteFinalRestoration5Items();
