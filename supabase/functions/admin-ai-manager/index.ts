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

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMeaningfully(value: string) {
  const stopWords = new Set([
    "add", "added", "set", "change", "make", "to", "inventory", "stock",
    "refill", "refilled", "restock", "restocked", "receive", "received",
    "remove", "removed", "used", "use", "damaged", "wasted", "waste",
    "sold", "deduct", "minus", "and", "the", "a", "an", "of", "for",
    "in", "into", "on", "my", "our", "just", "have", "has", "had",
    "slice", "slices", "piece", "pieces", "kg", "g", "gram", "grams",
    "ml", "l", "litre", "litres", "roll", "rolls", "loaf", "loaves",
    "pack", "packs", "bottle", "bottles", "unit", "units",
  ]);

  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !stopWords.has(token));
}

function parseInventoryIntent(
  message: string,
  ingredients: Array<{ id: string; name: string; unit?: string | null; current_stock?: number | null }>,
) {
  const normalizedMessage = normalizeText(message);
  const quantityMatch = normalizedMessage.match(/(\d+(?:\.\d+)?)/);
  if (!quantityMatch) return null;

  const quantity = Number(quantityMatch[1]);
  if (!quantity || Number.isNaN(quantity)) return null;

  let operation: "increase_stock" | "decrease_stock" | "set_stock_exactly" | null = null;
  if (/\b(set|change|make)\b/.test(normalizedMessage) && /\bto\b/.test(normalizedMessage)) {
    operation = "set_stock_exactly";
  } else if (/\b(refill|refilled|restock|restocked|add|added|receive|received|bought|buy|loaded)\b/.test(normalizedMessage)) {
    operation = "increase_stock";
  } else if (/\b(remove|removed|used|use|damaged|wasted|waste|sold|deduct|minus)\b/.test(normalizedMessage)) {
    operation = "decrease_stock";
  }

  if (!operation) return null;

  const meaningfulMessageTokens = tokenizeMeaningfully(message);
  const ingredientMatch =
    ingredients.find((ingredient) => {
      const normalizedIngredient = normalizeText(ingredient.name);
      return normalizedIngredient && normalizedMessage.includes(normalizedIngredient);
    }) ||
    ingredients
      .map((ingredient) => {
        const ingredientTokens = tokenizeMeaningfully(ingredient.name);
        const overlap = ingredientTokens.filter((token) => meaningfulMessageTokens.includes(token)).length;
        return { ingredient, overlap, tokenCount: ingredientTokens.length };
      })
      .filter((candidate) => candidate.overlap > 0)
      .sort((a, b) => {
        if (b.overlap !== a.overlap) return b.overlap - a.overlap;
        return a.tokenCount - b.tokenCount;
      })[0]?.ingredient;

  if (!ingredientMatch) {
    return {
      type: "inventory_adjustment_unmatched",
      operation,
      quantity,
    };
  }

  const currentStock = Number(ingredientMatch.current_stock ?? 0);
  const projectedStock =
    operation === "increase_stock"
      ? currentStock + quantity
      : operation === "decrease_stock"
        ? Math.max(0, currentStock - quantity)
        : Math.max(0, quantity);

  return {
    type: "inventory_adjustment",
    operation,
    ingredient_id: ingredientMatch.id,
    ingredient_name: ingredientMatch.name,
    unit: ingredientMatch.unit || "",
    quantity,
    current_stock: currentStock,
    projected_stock: projectedStock,
  };
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const { vendorId, message, messages = [] } = await req.json();
    if (!vendorId || !message?.trim()) {
      return jsonResponse({ error: "Missing vendorId or message" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await authedSupabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("vendor_id, role")
      .eq("id", user.id)
      .single();

    const allowedRoles = new Set(["owner", "admin", "inventory_staff"]);
    if (!profile || profile.vendor_id !== vendorId || !allowedRoles.has(String(profile.role || ""))) {
      return jsonResponse({ error: "Forbidden for this vendor" }, 403);
    }

    const isInventoryStaff = profile.role === "inventory_staff";

    const [{ data: vendor }, { data: ingredients }, { data: orders }, { data: expenses }, { data: menuItems }] =
      await Promise.all([
        supabase.from("vendors").select("id, name, payment_config").eq("id", vendorId).single(),
        supabase
          .from("ingredients")
          .select("id, name, current_stock, unit, low_stock_threshold")
          .eq("vendor_id", vendorId)
          .order("name")
          .limit(50),
        isInventoryStaff
          ? Promise.resolve({ data: [] })
          : supabase
              .from("orders")
              .select("id, order_number, total_price, status, created_at, customer_arrived")
              .eq("vendor_id", vendorId)
              .order("created_at", { ascending: false })
              .limit(50),
        isInventoryStaff
          ? Promise.resolve({ data: [] })
          : supabase
              .from("expenses")
              .select("description, amount, expense_date")
              .eq("vendor_id", vendorId)
              .order("expense_date", { ascending: false })
              .limit(20),
        isInventoryStaff
          ? Promise.resolve({ data: [] })
          : supabase
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
      return Number(item.current_stock ?? 0) <= threshold;
    });

    const inventoryIntent = parseInventoryIntent(message, ingredients || []);
    if (inventoryIntent) {
      if (inventoryIntent.type === "inventory_adjustment_unmatched") {
        return jsonResponse({
          reply: `I understood this as a stock update, but I could not match the ingredient name to your inventory list. Try the exact ingredient name shown in Inventory first.`,
          pending_action: null,
        });
      }

      return jsonResponse({
        reply:
          inventoryIntent.operation === "set_stock_exactly"
            ? `I heard: set ${inventoryIntent.ingredient_name} to ${inventoryIntent.quantity} ${inventoryIntent.unit}. Confirm this update?`
            : inventoryIntent.operation === "decrease_stock"
              ? `I heard: remove ${inventoryIntent.quantity} ${inventoryIntent.unit} from ${inventoryIntent.ingredient_name}. Confirm this stock update?`
              : `I heard: add ${inventoryIntent.quantity} ${inventoryIntent.unit} to ${inventoryIntent.ingredient_name}. Confirm this stock update?`,
        pending_action: inventoryIntent,
      });
    }

    const prompt = JSON.stringify({
      task:
        isInventoryStaff
          ? "Act like an inventory manager for the vendor. Answer using only the provided ingredient and stock data. Be concise, practical, and specific. You can help with restocking, shortages, wastage, and stock priorities. If the user asks about revenue, customers, billing, or private owner settings, say this staff mode only handles inventory operations."
          : "Act like an operations manager for the vendor. Answer the user's question using only the provided data. Be concise, practical, and specific. If data is missing, say so plainly. Focus on orders, revenue, stock, menu performance, and support load.",
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
${isInventoryStaff
  ? `You can ask me about:
- low-stock ingredients
- restocking priorities
- stock adjustments such as "add 54 slices of cheese"
- ingredients that are out of stock

Current stock snapshot for ${vendor.name}:
- Tracked ingredients: ${(ingredients || []).length}
- Out of stock: ${(ingredients || []).filter((item: any) => Number(item.current_stock ?? 0) <= 0).length}
- Low-stock items: ${lowStock.length}`
  : `You can ask me about:
- today's revenue and active orders
- stock risks and low-stock items
- which orders are stuck
- simple menu and operations questions

Current snapshot for ${vendor.name}:
- Active orders: ${activeOrders.length}
- Ready orders: ${activeOrders.filter((o: any) => o.status === "ready").length}
- Low-stock items: ${lowStock.length}
- Revenue across non-pending orders: R ${totalRevenue.toFixed(2)}`}
      `);
    }

    return jsonResponse({ reply, pending_action: null });
  } catch (error) {
    console.error("admin-ai-manager error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
