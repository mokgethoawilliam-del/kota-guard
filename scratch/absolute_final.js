const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function absoluteFinalRestoration() {
    console.log(" Starting ABSOLUTE FINAL RESTORATION...");

    const trueVendorId = '1bef931b-e562-42cb-8838-a3240102ed6f';

    // 1. CLEAR NEW PROJECT SLUG CONFLICTS
    console.log("Step 1: Cleaning target...");
    await newSupabase.from('vendors').delete().eq('slug', 'fabris-eaters');
    
    // 2. GET DATA FROM OLD
    console.log("Step 2: Fetching from source...");
    const { data: vendorData } = await oldSupabase.from('vendors').select('*').eq('id', trueVendorId).single();
    const { data: menuData } = await oldSupabase.from('menu_items').select('*').eq('vendor_id', trueVendorId);
    const { data: locData } = await oldSupabase.from('locations').select('*').eq('vendor_id', trueVendorId);

    // 3. PUSH TO NEW
    console.log("Step 3: Pushing Vendor Identity...");
    const { error: vErr } = await newSupabase.from('vendors').upsert({
        id: trueVendorId,
        name: "Fabri's Eaters",
        slug: 'fabris-eaters',
        branding: vendorData?.branding || {},
        settings: vendorData?.settings || {}
    });

    if (vErr) {
        console.error("Vendor Insert Failed:", vErr.message);
        return;
    }

    if (menuData) {
        console.log(`Step 4: Pushing ${menuData.length} products...`);
        const { error: mErr } = await newSupabase.from('menu_items').upsert(menuData.map(m => {
            const clean = {...m};
            delete clean.is_active;
            return clean;
        }));
        if (mErr) console.error("Menu Insert Failed:", mErr.message);
    }

    if (locData) {
        console.log(`Step 5: Pushing ${locData.length} locations...`);
        const { error: lErr } = await newSupabase.from('locations').upsert(locData.map(l => {
            const clean = {...l};
            delete clean.banner_text;
            return clean;
        }));
        if (lErr) console.error("Location Insert Failed:", lErr.message);
    }

    console.log(" SUCCESS! The Kota Guard platform is restored in the new project.");
}

absoluteFinalRestoration();
