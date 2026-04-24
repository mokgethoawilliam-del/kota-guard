import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const payload = JSON.parse(bodyText);
    const metadata = payload.data?.metadata || {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─────────────────────────────────────────────────────────────────────────
    // BRANCH A: Vendor Subscription Payment
    // Triggered when a vendor pays their R 399 monthly fee via the billing modal
    // ─────────────────────────────────────────────────────────────────────────
    if (metadata.payment_type === "vendor_subscription" && payload.event === "charge.success") {
      const vendorId = metadata.vendor_id;
      const platformSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

      if (!vendorId || !platformSecret) {
        return new Response("Missing vendor_id or platform secret", { status: 400, headers: corsHeaders });
      }

      // Verify Paystack signature using platform secret key
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(platformSecret),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
      );
      const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
      const hashHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

      const incomingSig = req.headers.get("x-paystack-signature");
      if (hashHex !== incomingSig) {
        console.error("Invalid platform signature");
        return new Response("Invalid signature", { status: 401, headers: corsHeaders });
      }

      // Activate the vendor subscription for 30 days
      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + 30);

      const { error: updateError } = await supabase
        .from("vendors")
        .update({
          subscription_status: "active",
          last_billing_date: new Date().toISOString(),
          next_billing_date: nextBilling.toISOString(),
        })
        .eq("id", vendorId);

      if (updateError) {
        console.error("Error activating vendor subscription:", updateError);
        return new Response("Failed to activate subscription", { status: 500, headers: corsHeaders });
      }

      console.log(`✅ Vendor ${vendorId} subscription activated. Next billing: ${nextBilling.toISOString()}`);
      return new Response(JSON.stringify({ message: "Subscription activated" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BRANCH B: Customer Order Payment
    // Triggered when a customer pays for their kota order
    // ─────────────────────────────────────────────────────────────────────────
    const orderId = metadata.order_id;

    if (!orderId) {
      // Not an order payment and not a subscription — ignore
      console.log("Unrecognised webhook type — ignoring");
      return new Response(JSON.stringify({ message: "Ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Look up the vendor for this order to verify using their own Paystack key
    const { data: orderData, error: orderLookupError } = await supabase
      .from("orders")
      .select("vendor_id")
      .eq("id", orderId)
      .single();

    if (orderLookupError || !orderData) {
      console.error("Could not find order:", orderLookupError);
      return new Response("Order not found", { status: 404, headers: corsHeaders });
    }

    // Fetch the vendor's own secret key (used to verify customer payment webhooks)
    const { data: vendorData } = await supabase
      .from("vendors")
      .select("payment_config, paystack_secret_key")
      .eq("id", orderData.vendor_id)
      .single();

    const vendorSecret = vendorData?.payment_config?.paystack_secret_key || vendorData?.paystack_secret_key;
    const verificationSecret = vendorSecret || "";

    if (!verificationSecret) {
      console.error("Missing vendor Paystack verification secret");
      return new Response("Vendor payment verification not configured", { status: 500, headers: corsHeaders });
    }

    // Verify signature with the vendor key when present; otherwise use platform key.
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(verificationSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
    const hashHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
    const incomingSig = req.headers.get("x-paystack-signature");
    if (hashHex !== incomingSig) {
      console.error("Invalid payment signature");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    if (payload.event === "charge.success") {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "paid",
          payment_reference: payload.data?.reference,
        })
        .eq("id", orderId)
        .eq("status", "pending");

      if (updateError) {
        console.error("Error updating order:", updateError);
        throw updateError;
      }

      console.log(`✅ Order ${orderId} marked as paid.`);
    }

    return new Response(JSON.stringify({ message: "Webhook processed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
