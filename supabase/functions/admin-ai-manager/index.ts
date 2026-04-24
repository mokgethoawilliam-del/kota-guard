import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

async function callGrok(apiKey: string, prompt: string) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4-fast-reasoning",
      messages: [
        {
          role: "system",
          content:
            "You are an operations-focused business manager for a food vendor. Reply in concise plain text with practical advice grounded in the provided shop data.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grok request failed: ${text}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callGemini(apiKey: string, prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${text}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { vendorId, message, messages = [] } = await req.json();
    if (!vendorId || !message?.trim()) {
      return jsonResponse({ error: "Missing vendorId or message" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [{ data: vendor }, { data: orders }, { data: ingredients }, { data: expenses }, { data: menuItems }] =
      await Promise.all([
        supabase.from("vendors").select("id, name, payment_config").eq("id", vendorId).single(),
        supabase
          .from("orders")
          .select("id, order_number, total_price, status, created_at, customer_arrived")
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("ingredients")
          .select("name, stock_quantity, unit, low_stock_threshold")
          .eq("vendor_id", vendorId)
          .order("name")
          .limit(50),
        supabase
          .from("expenses")
          .select("description, amount, expense_date")
          .eq("vendor_id", vendorId)
          .order("expense_date", { ascending: false })
          .limit(20),
        supabase
          .from("menu_items")
          .select("name, price, is_available")
          .eq("vendor_id", vendorId)
          .order("price")
          .limit(50),
      ]);

    if (!vendor) {
      return jsonResponse({ error: "Vendor not found" }, 404);
    }

    const activeOrders = (orders || []).filter((order: any) => !["completed", "refunded"].includes(order.status));
    const totalRevenue = (orders || [])
      .filter((order: any) => ["paid", "preparing", "ready", "completed"].includes(order.status))
      .reduce((sum: number, order: any) => sum + Number(order.total_price || 0), 0);
    const lowStock = (ingredients || []).filter((item: any) => {
      const threshold = Number(item.low_stock_threshold ?? 5);
      return Number(item.stock_quantity ?? 0) <= threshold;
    });

    const prompt = JSON.stringify({
      task:
        "Act like an operations manager for the vendor. Answer the user's question using only the provided data. Be concise, practical, and specific. If data is missing, say so plainly. Focus on orders, revenue, stock, menu performance, and support load.",
      vendor: {
        id: vendor.id,
        name: vendor.name,
      },
      shop_snapshot: {
        total_revenue: totalRevenue,
        active_order_count: activeOrders.length,
        ready_order_count: activeOrders.filter((o: any) => o.status === "ready").length,
        low_stock_count: lowStock.length,
      },
      recent_orders: orders || [],
      low_stock_items: lowStock,
      recent_expenses: expenses || [],
      menu_items: menuItems || [],
      recent_messages: messages.slice(-8),
      latest_user_message: message,
    });

    const grokApiKey = vendor.payment_config?.grok_api_key;
    const geminiApiKey = vendor.payment_config?.gemini_api_key;

    let reply = "";

    if (grokApiKey) {
      reply = await callGrok(grokApiKey, prompt).catch(() => "");
    }

    if (!reply && geminiApiKey) {
      reply = await callGemini(geminiApiKey, prompt).catch(() => "");
    }

    if (!reply) {
      reply = normalizeJson(`
You can ask me about:
- today's revenue and active orders
- stock risks and low-stock items
- which orders are stuck
- simple menu and operations questions

Current snapshot for ${vendor.name}:
- Active orders: ${activeOrders.length}
- Ready orders: ${activeOrders.filter((o: any) => o.status === "ready").length}
- Low-stock items: ${lowStock.length}
- Revenue across non-pending orders: R ${totalRevenue.toFixed(2)}
      `);
    }

    return jsonResponse({ reply });
  } catch (error) {
    console.error("admin-ai-manager error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
