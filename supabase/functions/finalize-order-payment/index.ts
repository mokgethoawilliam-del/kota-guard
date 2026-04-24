import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePin() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(1000 + (bytes[0] % 9000));
}

function getDateCode() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${mm}${dd}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { order_id: orderId, reference } = await req.json();

    if (!orderId || !reference) {
      return new Response(JSON.stringify({ error: "Missing order_id or reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, vendor_id, location_id, total_price, status, order_number")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status !== "pending") {
      return new Response(JSON.stringify({ error: "Order is not pending" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: vendor } = await supabase
      .from("vendors")
      .select("payment_config, paystack_secret_key")
      .eq("id", order.vendor_id)
      .single();

    const vendorSecret = vendor?.payment_config?.paystack_secret_key || vendor?.paystack_secret_key;
    const paystackSecret = vendorSecret || "";

    if (!paystackSecret) {
      return new Response(JSON.stringify({ error: "Vendor payment verification is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      },
    );

    const verifyData = await verifyRes.json();
    const payment = verifyData?.data;

    if (!verifyRes.ok || !verifyData?.status || payment?.status !== "success") {
      return new Response(JSON.stringify({ error: "Payment was not verified" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedAmount = Math.round(Number(order.total_price) * 100);
    const paidAmount = Number(payment.amount);
    const paidCurrency = String(payment.currency || "").toUpperCase();
    const metadataOrderId = payment.metadata?.order_id;

    if (paidAmount !== expectedAmount || paidCurrency !== "ZAR" || metadataOrderId !== order.id) {
      return new Response(JSON.stringify({ error: "Payment details do not match this order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: location } = await supabase
      .from("locations")
      .select("name")
      .eq("id", order.location_id)
      .single();

    const prefix = String(location?.name || "ot").slice(0, 2).toLowerCase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("location_id", order.location_id)
      .neq("status", "pending")
      .gte("created_at", startOfDay.toISOString());

    const orderNumber = `${prefix}/${getDateCode()}/${String((count || 0) + 1).padStart(3, "0")}`;
    const collectionPin = generatePin();

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        order_number: orderNumber,
        payment_reference: reference,
        collection_pin: collectionPin,
      })
      .eq("id", order.id)
      .eq("status", "pending")
      .select("id, order_number, collection_pin")
      .single();

    if (updateError || !updatedOrder) {
      return new Response(JSON.stringify({ error: "Could not finalize order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      order_number: updatedOrder.order_number,
      collection_pin: updatedOrder.collection_pin,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Finalize payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
