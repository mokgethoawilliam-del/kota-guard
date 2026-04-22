import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth — only authenticated vendors can trigger billing
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Auth client — to verify who is calling
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch the vendor record for this user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from("vendors")
      .select("id, name, monthly_rate")
      .eq("owner_id", user.id)
      .single();

    if (vendorError || !vendor) {
      return new Response(JSON.stringify({ error: "Vendor not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = vendor.monthly_rate ?? 399.00;

    // 3. Call Paystack Transaction Initialize API using platform secret key
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
    if (!paystackSecret) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paystackRef = `SUB-${vendor.id.slice(0, 8)}-${Date.now()}`;

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(amount * 100), // Paystack uses kobo/cents
        currency: "ZAR",
        reference: paystackRef,
        callback_url: `https://kotaguard.vercel.app/dashboard?billing=success`,
        metadata: {
          payment_type: "vendor_subscription",
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          user_id: user.id,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("Paystack error:", paystackData);
      return new Response(JSON.stringify({ error: "Failed to initialize payment", detail: paystackData.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Log the pending subscription attempt in the database
    await supabaseAdmin.from("vendors").update({
      subscription_status: "pending_payment",
      last_billing_date: new Date().toISOString(),
    }).eq("id", vendor.id);

    // 5. Return the Paystack authorization URL to the frontend
    return new Response(JSON.stringify({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackRef,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
