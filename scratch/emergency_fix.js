const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ofizmorcfmkttuksdyhq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
    console.log("Starting Emergency Data Repair...");

    // 1. Get all vendors to see names and slugs
    const { data: vendors } = await supabase.from('kg_vendors').select('id, name, slug');
    console.log("Current Vendors:", vendors);

    // 2. Find the one with most menu items
    const { data: counts } = await supabase.from('kg_menu_items').select('vendor_id');
    const tally = {};
    counts.forEach(c => tally[c.vendor_id] = (tally[c.vendor_id] || 0) + 1);
    
    let realVendorId = null;
    let max = -1;
    for (const id in tally) {
        if (tally[id] > max) {
            max = tally[id];
            realVendorId = id;
        }
    }

    if (!realVendorId) {
        console.error("Critical Failure: Could not find any vendor with menu items.");
        return;
    }

    console.log(`Identified Real Vendor ID: ${realVendorId} with ${max} items.`);

    // 3. Find ghosts (other vendors with same slug)
    const ghostVendors = vendors.filter(v => v.slug === 'fabris-eaters' && v.id !== realVendorId);
    console.log(`Found ${ghostVendors.length} ghost vendors to remove.`);

    // 4. Perform the Merge
    // Remove slug from ghosts first
    for (const ghost of ghostVendors) {
        await supabase.from('kg_vendors').update({ slug: `fixed-${ghost.id.slice(0,5)}` }).eq('id', ghost.id);
    }

    // Set slug to REAL vendor
    const { error: updateErr } = await supabase.from('kg_vendors').update({ slug: 'fabris-eaters' }).eq('id', realVendorId);
    if (updateErr) {
        console.error("Failed to update real vendor slug:", updateErr);
    } else {
        console.log("Successfully mapped 'fabris-eaters' to Real Data!");
    }

    // Optional: Delete ghosts
    for (const ghost of ghostVendors) {
        await supabase.from('kg_vendors').delete().eq('id', ghost.id);
    }

    console.log("Repair Complete.");
}

repair();
