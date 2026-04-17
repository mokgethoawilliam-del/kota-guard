const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function migrate() {
    console.log(" Starting Data Migration...");

    try {
        // 1. Migrate VENDORS -> KG_VENDORS
        console.log("--- Migrating Vendors ---");
        const { data: vendors } = await oldSupabase.from('vendors').select('*');
        if (vendors) {
            for (const v of vendors) {
                const { error } = await newSupabase.from('kg_vendors').upsert({
                    id: v.id,
                    name: v.name,
                    slug: v.slug || 'fabris-eaters',
                    branding: v.branding,
                    settings: v.settings,
                    created_at: v.created_at
                });
                if (error) console.error(`Error migrating vendor ${v.name}:`, error.message);
            }
        }

        // 2. Migrate MENU_ITEMS -> KG_MENU_ITEMS
        console.log("--- Migrating Menu Items ---");
        const { data: menu } = await oldSupabase.from('menu_items').select('*');
        if (menu) {
            const chunks = [];
            for (let i = 0; i < menu.length; i += 50) chunks.push(menu.slice(i, i + 50));
            for (const chunk of chunks) {
                const { error } = await newSupabase.from('kg_menu_items').upsert(chunk);
                if (error) console.error("Error migrating menu chunk:", error.message);
            }
            console.log(`Migrated ${menu.length} menu items.`);
        }

        // 3. Migrate LOCATIONS -> KG_LOCATIONS
        console.log("--- Migrating Locations ---");
        const { data: locs } = await oldSupabase.from('locations').select('*');
        if (locs) {
            const { error } = await newSupabase.from('kg_locations').upsert(locs);
            if (error) console.error("Error migrating locations:", error.message);
        }

        // 4. Migrate INGREDIENTS -> KG_INGREDIENTS
        console.log("--- Migrating Ingredients ---");
        const { data: ings } = await oldSupabase.from('ingredients').select('*');
        if (ings) {
            const { error } = await newSupabase.from('kg_ingredients').upsert(ings);
            if (error) console.error("Error migrating ingredients:", error.message);
        }

        // 5. Migrate TESTIMONIALS -> KG_TESTIMONIALS
        console.log("--- Migrating Testimonials ---");
        const { data: tests } = await oldSupabase.from('testimonials').select('*');
        if (tests) {
            const { error } = await newSupabase.from('kg_testimonials').upsert(tests);
            if (error) console.error("Error migrating testimonials:", error.message);
        }

        // 6. Migrate SITE_GALLERY -> KG_SITE_GALLERY
        console.log("--- Migrating Gallery ---");
        const { data: gallery } = await oldSupabase.from('site_gallery').select('*');
        if (gallery) {
            const { error } = await newSupabase.from('kg_site_gallery').upsert(gallery);
            if (error) console.error("Error migrating gallery:", error.message);
        }

        console.log(" Migration Finished Successfully!");
    } catch (err) {
        console.error(" Critical Migration Failure:", err);
    }
}

migrate();
