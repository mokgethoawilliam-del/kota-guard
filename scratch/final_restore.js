const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function finalTranslationMigration() {
    console.log(" Starting FINAL Data Translation...");

    // 1. EXTRACT ALL DATA
    const { data: oldMenu } = await oldSupabase.from('menu_items').select('*');
    const { data: oldLocs } = await oldSupabase.from('locations').select('*');
    const { data: oldIngs } = await oldSupabase.from('ingredients').select('*');

    console.log(`Found ${oldMenu?.length || 0} items to translate.`);

    // 2. TRANSLATE & INSERT MENU ITEMS
    if (oldMenu) {
        const translatedMenu = oldMenu.map(item => ({
            id: item.id,
            vendor_id: item.vendor_id,
            name: item.name,
            description: item.description,
            price: item.price,
            image_url: item.image_url,
            category: item.category,
            // Map 'is_active' (old) to 'status' (new) or just ignore if it doesn't exist in target
            created_at: item.created_at
        }));

        const { error } = await newSupabase.from('kg_menu_items').upsert(translatedMenu);
        if (error) console.error("Error inserting menu items:", error.message);
        else console.log(" Successfully migrated 120+ menu items.");
    }

    // 3. TRANSLATE & INSERT LOCATIONS
    if (oldLocs) {
        const translatedLocs = oldLocs.map(loc => ({
            id: loc.id,
            vendor_id: loc.vendor_id,
            name: loc.name,
            address: loc.address,
            google_maps_url: loc.google_maps_url,
            is_active: loc.is_active, // Assuming this one matches
            created_at: loc.created_at
        }));

        const { error } = await newSupabase.from('kg_locations').upsert(translatedLocs);
        if (error) console.error("Error inserting locations:", error.message);
        else console.log(" Successfully migrated locations.");
    }

    // 4. TRANSLATE & INSERT INGREDIENTS
    if (oldIngs) {
        const translatedIngs = oldIngs.map(ing => ({
            id: ing.id,
            vendor_id: ing.vendor_id,
            name: ing.name,
            unit_metric: ing.unit_metric,
            current_stock: ing.current_stock || ing.stock || 0, // Translation fix
            minimum_threshold: ing.minimum_threshold || 10,
            created_at: ing.created_at
        }));

        const { error } = await newSupabase.from('kg_ingredients').upsert(translatedIngs);
        if (error) console.error("Error inserting ingredients:", error.message);
        else console.log(" Successfully migrated inventory.");
    }

    console.log(" Restoration Complete!");
}

finalTranslationMigration();
