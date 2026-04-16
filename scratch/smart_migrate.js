const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT (Source)
const oldUrl = "https://pipxmnjlgqyakatzdsza.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHhtbmpsZ3F5YWthdHpkc3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE5NTgsImV4cCI6MjA4ODQ2Nzk1OH0.PAWVfzgEURbJTXjgbXNY63ylhjqxbGiFXAYsPwo_dHw";
const oldSupabase = createClient(oldUrl, oldKey);

// NEW PROJECT (Target)
const newUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const newKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const newSupabase = createClient(newUrl, newKey);

async function smartMigrate() {
    console.log("🚀 Starting SMART Data Migration...");

    const tableMapping = [
        { old: 'vendors', new: 'kg_vendors' },
        { old: 'menu_items', new: 'kg_menu_items' },
        { old: 'locations', new: 'kg_locations' },
        { old: 'ingredients', new: 'kg_ingredients' },
        { old: 'testimonials', new: 'kg_testimonials' },
        { old: 'site_gallery', new: 'kg_site_gallery' }
    ];

    for (const mapping of tableMapping) {
        console.log(`--- Migrating ${mapping.old} -> ${mapping.new} ---`);
        
        // 1. Fetch data from old project
        const { data: oldData, error: fetchErr } = await oldSupabase.from(mapping.old).select('*');
        if (fetchErr || !oldData) {
            console.error(`Error fetching ${mapping.old}:`, fetchErr?.message);
            continue;
        }

        if (oldData.length === 0) {
            console.log(`No data found in ${mapping.old}.`);
            continue;
        }

        // 2. Fetch columns from new project (Trial insert of 1st row to see what works)
        const sampleRow = oldData[0];
        const { data: targetColumns, error: colErr } = await newSupabase.from(mapping.new).select('*').limit(0);
        
        // Use a dummy insert to let Supabase complain about columns, or just filter based on what we see in the DB.
        // For simplicity in this script, we'll try to insert and catch errors, but we can also filter for common columns.
        
        // Filter known columns for Kota Guard v2 schema
        const filteredData = oldData.map(row => {
            const newRow = { ...row };
            // Remove common columns that might have changed
            delete newRow.is_active; 
            delete newRow.banner_text;
            return newRow;
        });

        // 3. Batch Insert
        const chunks = [];
        for (let i = 0; i < filteredData.length; i += 100) chunks.push(filteredData.slice(i, i + 100));
        
        for (const chunk of chunks) {
            const { error: insertErr } = await newSupabase.from(mapping.new).insert(chunk);
            if (insertErr) {
                console.error(`Error in ${mapping.new} batch:`, insertErr.message);
                // Try individual insert as fallback
                for (const row of chunk) {
                    const { error } = await newSupabase.from(mapping.new).insert(row);
                    if (error) console.warn(`Failed row in ${mapping.new}:`, error.message);
                }
            }
        }
        console.log(`Finished ${mapping.new}.`);
    }

    console.log("✅ SMART Migration Finished Successfully!");
}

smartMigrate();
