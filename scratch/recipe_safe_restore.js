const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function recipeSafeRestore() {
    console.log(" Starting RECIPE-SAFE FINAL RESTORATION...");

    const trueVendorId = '1bef931b-e562-42cb-8838-a3240102ed6f';

    // 1. Fetch from source
    const { data: menuData } = await oldSupabase.from('menu_items').select('*').eq('vendor_id', trueVendorId);
    
    // 2. Insert Menu Items (RECIPE-SAFE)
    if (menuData) {
        console.log(`Pushing ${menuData.length} products...`);
        const cleanedMenu = menuData.map(m => ({
            id: m.id,
            vendor_id: m.vendor_id,
            name: m.name,
            description: m.description,
            price: m.price,
            image_url: m.image_url,
            category: m.category,
            // REMOVED recipe_json and is_active
            created_at: m.created_at
        }));
        const { error: mErr } = await newSupabase.from('menu_items').upsert(cleanedMenu);
        if (mErr) console.error("Menu Insert Failed:", mErr.message);
        else console.log(" Menu Successfully Restored!");
    }

    console.log(" THE MIGRATION IS FINISHED!");
}

recipeSafeRestore();
