const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function finalConnection() {
    console.log(" Starting FINAL CONNECTION...");

    // 1. CLEAR THE SLUG CONFLICT FIRST
    console.log("Clearing slug conflicts...");
    await newSupabase.from('kg_vendors').update({ slug: 'old-conflict' }).eq('slug', 'fabris-eaters');

    // 2. GET REAL DATA FROM OLD
    const { data: vendors } = await oldSupabase.from('vendors').select('*').ilike('name', '%Fabri%');
    const { data: menu } = await oldSupabase.from('menu_items').select('*');

    if (!vendors || vendors.length === 0) return;
    const realVendor = vendors[0];

    // 3. INSERT REAL VENDOR
    console.log("Inserting Real Vendor...");
    const { error: vErr } = await newSupabase.from('kg_vendors').upsert({
        id: realVendor.id,
        name: realVendor.name,
        slug: 'fabris-eaters',
        branding: realVendor.branding,
        settings: realVendor.settings
    });
    
    if (vErr) {
        console.error("Failed to insert vendor:", vErr.message);
        return;
    }

    // 4. INSERT MENU
    if (menu) {
        const myMenu = menu.filter(m => m.vendor_id === realVendor.id).map(m => {
            const clean = {...m};
            delete clean.is_active;
            return clean;
        });
        console.log(`Inserting ${myMenu.length} menu items...`);
        const { error: mErr } = await newSupabase.from('kg_menu_items').upsert(myMenu);
        if (mErr) console.error("Menu error:", mErr.message);
        else console.log(" Menu Successfully Restored!");
    }

    console.log(" YOUR SITE IS LIVE!");
}

finalConnection();
