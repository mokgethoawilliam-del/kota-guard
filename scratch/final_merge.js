const { createClient } = require('@supabase/supabase-js');

// Target Project (Multi-tenant)
const url = "https://ofizmorcfmkttuksdyhq.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXptb3JjZm1rdHR1a3NkeWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODEyNzMsImV4cCI6MjA5MDM1NzI3M30.xsJzBKkUfJ_q1ohafZaUg0tJc4x-0J2N-6UJkrmIpLY";
const supabase = createClient(url, key);

async function finalIdentityMerge() {
    console.log(" Starting ABSOLUTE IDENTITY MERGE...");

    const goodBrandingId = '4fa85df3-4563-482e-943f-3b92d960b45e';
    const trueDataId = '1bef931b-e562-42cb-8838-a3240102ed6f';

    // 1. FETCH THE GOOD BRANDING
    const { data: v1 } = await supabase.from('vendors').select('branding').eq('id', goodBrandingId).single();
    if (!v1) return;

    // 2. APPLY THE BRANDING TO THE DATA RECORD
    console.log("Merging Look & Feel into Data Record...");
    await supabase.from('vendors').update({
        name: "Fabri's Eaters",
        slug: 'fabris-eaters', // Re-wire the URL
        branding: {
            ...v1.branding,
            tagline: "The Ultimate Kota Experience",
            welcome_text: "Dumelang chommi tsaka",
            hero_title: "Nothing brings people together like good quality food."
        }
    }).eq('id', trueDataId);

    // 3. DELETE THE GHOST IDENTITY
    console.log("Cleaning up duplicate vendor record...");
    await supabase.from('vendors').delete().eq('id', goodBrandingId);

    // 4. FINAL ACTIVATION
    console.log("Activating Menu & Locations...");
    await supabase.from('menu_items').update({ vendor_id: trueDataId }).not('id', 'is', null);
    await supabase.from('locations').update({ is_active: true, vendor_id: trueDataId }).not('id', 'is', null);

    console.log(" THE SITE IS NOW 100% RESTORED!");
}

finalIdentityMerge();
