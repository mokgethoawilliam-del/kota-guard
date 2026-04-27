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

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function startOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

function endOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

function formatMonthLabel(monthIndex: number) {
  return Object.keys(MONTH_INDEX).find((key) => MONTH_INDEX[key] === monthIndex)?.replace(/^./, (s) => s.toUpperCase()) || "";
}

function formatDateRangeLabel(startDate: Date, endDate: Date) {
  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const sameMonth = sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();
  const startLabel = `${formatMonthLabel(startDate.getUTCMonth())} ${startDate.getUTCFullYear()}`;
  const endLabel = `${formatMonthLabel(endDate.getUTCMonth())} ${endDate.getUTCFullYear()}`;
  if (sameMonth) return startLabel;
  if (sameYear) return `${formatMonthLabel(startDate.getUTCMonth())} to ${formatMonthLabel(endDate.getUTCMonth())} ${startDate.getUTCFullYear()}`;
  return `${startLabel} to ${endLabel}`;
}

function parseDateRangeIntent(message: string) {
  const normalized = normalizeText(message);
  const explicitYearMatch = normalized.match(/\b(20\d{2})\b/);
  const year = explicitYearMatch ? Number(explicitYearMatch[1]) : new Date().getUTCFullYear();
  const monthNames = Object.keys(MONTH_INDEX).filter((month) => normalized.includes(month));

  if (monthNames.length >= 2) {
    const firstMonth = MONTH_INDEX[monthNames[0]];
    const secondMonth = MONTH_INDEX[monthNames[1]];
    if (firstMonth !== undefined && secondMonth !== undefined) {
      const startMonth = Math.min(firstMonth, secondMonth);
      const endMonth = Math.max(firstMonth, secondMonth);
      const startDate = startOfMonth(year, startMonth);
      const endDate = endOfMonth(year, endMonth);
      return {
        startDateIso: startDate.toISOString(),
        endDateIso: endDate.toISOString(),
        dateLabel: `${formatMonthLabel(startMonth)} ${year} to ${formatMonthLabel(endMonth)} ${year}`,
      };
    }
  }

  if (monthNames.length === 1) {
    const monthIndex = MONTH_INDEX[monthNames[0]];
    if (monthIndex !== undefined) {
      const startDate = startOfMonth(year, monthIndex);
      const endDate = endOfMonth(year, monthIndex);
      return {
        startDateIso: startDate.toISOString(),
        endDateIso: endDate.toISOString(),
        dateLabel: `${formatMonthLabel(monthIndex)} ${year}`,
      };
    }
  }

  const now = new Date();
  const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  if (/\btoday\b/.test(normalized)) {
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return {
      startDateIso: utcToday.toISOString(),
      endDateIso: endDate.toISOString(),
      dateLabel: "Today",
    };
  }

  if (/\bthis week\b/.test(normalized)) {
    const day = utcToday.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const startDate = new Date(utcToday);
    startDate.setUTCDate(startDate.getUTCDate() - diffToMonday);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);
    return {
      startDateIso: startDate.toISOString(),
      endDateIso: endDate.toISOString(),
      dateLabel: "This Week",
    };
  }

  if (/\bthis month\b/.test(normalized)) {
    const startDate = startOfMonth(now.getUTCFullYear(), now.getUTCMonth());
    const endDate = endOfMonth(now.getUTCFullYear(), now.getUTCMonth());
    return {
      startDateIso: startDate.toISOString(),
      endDateIso: endDate.toISOString(),
      dateLabel: "This Month",
    };
  }

  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
  return {
    startDateIso: defaultStart.toISOString(),
    endDateIso: defaultEnd.toISOString(),
    dateLabel: "Last 30 Days",
  };
}

function parsePdfReportIntent(message: string) {
  const normalized = normalizeText(message);
  const wantsReport = /\b(pdf|report)\b/.test(normalized) || /\b(generate|create|make|export)\b/.test(normalized);
  if (!wantsReport) return null;

  const countMatch = normalized.match(/\btop\s+(\d{1,2})\b/);
  const limit = Math.min(Math.max(Number(countMatch?.[1] || 10), 1), 50);
  const range = parseDateRangeIntent(message);
  const dateLabel = range?.dateLabel || "Last 30 Days";
  const startDateIso = range?.startDateIso || new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
  const endDateIso = range?.endDateIso || new Date().toISOString();

  let kind:
    | "top_buyers"
    | "top_items"
    | "sales_summary"
    | "net_profit"
    | "repeat_customers"
    | "unpaid_orders"
    | "kitchen_performance"
    | "stock_usage_wastage"
    | "staff_performance"
    | "reservations_summary"
    | "expenses_summary"
    | "low_stock"
    | "order_status"
    | "branch_performance"
    | null = null;

  if (/\btop\b/.test(normalized) && /\b(buyer|buyers|customer|customers)\b/.test(normalized)) {
    kind = "top_buyers";
  } else if (/\btop\b/.test(normalized) && /\b(item|items|menu|product|products|seller|sellers)\b/.test(normalized)) {
    kind = "top_items";
  } else if (/\b(repeat|returning|loyal)\b/.test(normalized) && /\b(customer|customers|buyer|buyers)\b/.test(normalized)) {
    kind = "repeat_customers";
  } else if (/\b(net profit|profit)\b/.test(normalized)) {
    kind = "net_profit";
  } else if (/\b(unpaid|pending|owing|debt|debtor|debtors)\b/.test(normalized) && /\b(order|orders|customer|customers|report|pdf)\b/.test(normalized)) {
    kind = "unpaid_orders";
  } else if (/\b(kitchen|preparing|ready|collection|delivery)\b/.test(normalized) && /\b(report|performance|pdf|summary)\b/.test(normalized)) {
    kind = "kitchen_performance";
  } else if (/\b(wastage|waste|stock usage|usage|consumption|inventory movement)\b/.test(normalized)) {
    kind = "stock_usage_wastage";
  } else if (/\b(staff|employee|employees|team|cashier|runner|clerk)\b/.test(normalized) && /\b(report|performance|activity|pdf)\b/.test(normalized)) {
    kind = "staff_performance";
  } else if (/\b(reservation|reservations|booking|bookings|table|venue)\b/.test(normalized) && /\b(report|summary|activity|pdf)\b/.test(normalized)) {
    kind = "reservations_summary";
  } else if (/\b(branch|branches|location|locations|stall|stalls)\b/.test(normalized) && /\b(report|performance|sales|revenue|pdf)\b/.test(normalized)) {
    kind = "branch_performance";
  } else if (/\b(expense|expenses|cost|costs|spend)\b/.test(normalized)) {
    kind = "expenses_summary";
  } else if (/\b(stock|inventory|low stock|restock|shortage|shortages)\b/.test(normalized)) {
    kind = "low_stock";
  } else if (/\b(order|orders|status|stuck|kitchen|ready|preparing)\b/.test(normalized)) {
    kind = "order_status";
  } else if (/\b(sales|revenue|profit|performance|summary)\b/.test(normalized)) {
    kind = "sales_summary";
  }

  if (!kind) return null;

  return {
    type: "pdf_report_request",
    reportKind: kind,
    limit,
    startDateIso,
    endDateIso,
    dateLabel,
  };
}

function parseInventoryIntent(
  message: string,
  ingredients: Array<{
    id: string;
    name: string;
    current_stock?: number | null;
    restock_input_label?: string | null;
    restock_input_quantity?: number | null;
    restock_output_quantity?: number | null;
  }>,
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
  const restockLabel = normalizeText(ingredientMatch.restock_input_label || "");
  const restockInputQuantity = Number(ingredientMatch.restock_input_quantity ?? 0);
  const restockOutputQuantity = Number(ingredientMatch.restock_output_quantity ?? 0);
  const mentionsRestockLabel = restockLabel && normalizedMessage.includes(restockLabel);
  const convertedQuantity =
    operation === "increase_stock" &&
    mentionsRestockLabel &&
    restockInputQuantity > 0 &&
    restockOutputQuantity > 0
      ? Number(((quantity / restockInputQuantity) * restockOutputQuantity).toFixed(2))
      : quantity;
  const projectedStock =
    operation === "increase_stock"
      ? currentStock + convertedQuantity
      : operation === "decrease_stock"
        ? Math.max(0, currentStock - convertedQuantity)
        : Math.max(0, quantity);

  return {
    type: "inventory_adjustment",
    operation,
    ingredient_id: ingredientMatch.id,
    ingredient_name: ingredientMatch.name,
    quantity: convertedQuantity,
    source_quantity: quantity,
    source_label: mentionsRestockLabel ? ingredientMatch.restock_input_label || "" : "",
    restock_note:
      mentionsRestockLabel && convertedQuantity !== quantity
        ? `${quantity} ${ingredientMatch.restock_input_label} converts to ${convertedQuantity} usable stock.`
        : "",
    current_stock: currentStock,
    projected_stock: projectedStock,
  };
}

async function callXaiGrok(apiKey: string, prompt: string) {
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

async function callGroqCloud(apiKey: string, prompt: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
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
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GroqCloud request failed: ${text}`);
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
          .select("id, name, current_stock, low_stock_threshold, restock_input_label, restock_input_quantity, restock_output_quantity")
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
            ? `I heard: set ${inventoryIntent.ingredient_name} to ${inventoryIntent.quantity}. Confirm this update?`
            : inventoryIntent.operation === "decrease_stock"
              ? `I heard: remove ${inventoryIntent.quantity} from ${inventoryIntent.ingredient_name}. Confirm this stock update?`
              : inventoryIntent.source_label
                ? `I heard: add ${inventoryIntent.source_quantity} ${inventoryIntent.source_label} of ${inventoryIntent.ingredient_name}. Confirm this stock update?`
                : `I heard: add ${inventoryIntent.quantity} to ${inventoryIntent.ingredient_name}. Confirm this stock update?`,
        pending_action: inventoryIntent,
      });
    }

    const reportIntent = parsePdfReportIntent(message);
    if (reportIntent && !isInventoryStaff) {
      const { data: reportReservations, error: reportReservationsError } = await supabase
        .from("reservations")
        .select("reservation_type, status, customer_name, customer_phone, guest_count, reservation_date, reservation_time, created_at, location_id")
        .eq("vendor_id", vendorId)
        .gte("reservation_date", reportIntent.startDateIso.slice(0, 10))
        .lte("reservation_date", reportIntent.endDateIso.slice(0, 10))
        .order("reservation_date", { ascending: true })
        .limit(1000);

      if (reportReservationsError) throw reportReservationsError;

      const { data: reportExpenses, error: reportExpensesError } = await supabase
        .from("expenses")
        .select("description, amount, expense_date")
        .eq("vendor_id", vendorId)
        .gte("expense_date", reportIntent.startDateIso)
        .lte("expense_date", reportIntent.endDateIso)
        .order("expense_date", { ascending: false })
        .limit(500);

      if (reportExpensesError) throw reportExpensesError;

      const { data: reportAdjustments, error: reportAdjustmentsError } = await supabase
        .from("inventory_adjustments")
        .select("operation, quantity, previous_stock, new_stock, note, source, created_at, actor_user_id")
        .eq("vendor_id", vendorId)
        .gte("created_at", reportIntent.startDateIso)
        .lte("created_at", reportIntent.endDateIso)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (reportAdjustmentsError) throw reportAdjustmentsError;

      const actorIds = Array.from(new Set((reportAdjustments || []).map((entry: any) => entry.actor_user_id).filter(Boolean)));
      let profilesById = new Map<string, any>();
      if (actorIds.length > 0) {
        const { data: adjustmentProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", actorIds);
        profilesById = new Map((adjustmentProfiles || []).map((profile: any) => [profile.id, profile]));
      }

      const { data: pendingOrders, error: pendingOrdersError } = await supabase
        .from("orders")
        .select("order_number, customer_name, customer_phone, total_price, created_at, status")
        .eq("vendor_id", vendorId)
        .eq("status", "pending")
        .gte("created_at", reportIntent.startDateIso)
        .lte("created_at", reportIntent.endDateIso)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (pendingOrdersError) throw pendingOrdersError;

      const { data: reportOrders, error: reportOrdersError } = await supabase
        .from("orders")
        .select(`
          customer_name,
          customer_phone,
          total_price,
          created_at,
          status,
          customer_arrived,
          locations (name),
          order_items (
            quantity,
            menu_items (name)
          )
        `)
        .eq("vendor_id", vendorId)
        .gte("created_at", reportIntent.startDateIso)
        .lte("created_at", reportIntent.endDateIso)
        .in("status", ["paid", "preparing", "ready", "completed"])
        .order("created_at", { ascending: false })
        .limit(2000);

      if (reportOrdersError) throw reportOrdersError;

      const typedOrders = (reportOrders || []) as any[];
      const typedReservations = (reportReservations || []) as any[];
      const typedExpenses = (reportExpenses || []) as any[];
      const typedAdjustments = (reportAdjustments || []) as any[];
      const typedPendingOrders = (pendingOrders || []) as any[];
      const generatedAt = new Date().toISOString();

      if (reportIntent.reportKind === "top_buyers") {
        const buyersMap = new Map<string, any>();
        for (const order of typedOrders) {
          const key = `${order.customer_phone || ""}::${order.customer_name || ""}`;
          const existing = buyersMap.get(key);
          const orderTotal = Number(order.total_price || 0);
          if (!existing) {
            buyersMap.set(key, {
              customer_name: order.customer_name || "Walk-in",
              customer_phone: order.customer_phone || "-",
              order_count: 1,
              total_spend: orderTotal,
              latest_order_at: order.created_at,
            });
            continue;
          }
          existing.order_count += 1;
          existing.total_spend += orderTotal;
          if (new Date(order.created_at).getTime() > new Date(existing.latest_order_at).getTime()) {
            existing.latest_order_at = order.created_at;
          }
        }

        const rankedBuyers = Array.from(buyersMap.values())
          .sort((a, b) => (b.total_spend - a.total_spend) || (b.order_count - a.order_count))
          .slice(0, reportIntent.limit)
          .map((buyer, index) => ({ rank: index + 1, ...buyer, total_spend: Number(buyer.total_spend.toFixed(2)) }));

        if (rankedBuyers.length === 0) {
          return jsonResponse({ reply: `I could not find enough order data for ${reportIntent.dateLabel} to build that report yet.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared a branded PDF report for your top ${rankedBuyers.length} buyers from ${reportIntent.dateLabel}. Generate it when you're ready.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "top_buyers",
            title: `Top ${rankedBuyers.length} Buyers`,
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "rank", label: "Rank" },
              { key: "customer_name", label: "Buyer" },
              { key: "customer_phone", label: "WhatsApp" },
              { key: "order_count", label: "Orders" },
              { key: "total_spend", label: "Total Spend", format: "currency" },
              { key: "latest_order_at", label: "Last Order", format: "date" },
            ],
            rows: rankedBuyers,
            generated_at: generatedAt,
            summary: {
              buyer_count: rankedBuyers.length,
              total_revenue: Number(rankedBuyers.reduce((sum, buyer) => sum + buyer.total_spend, 0).toFixed(2)),
            },
          },
        });
      }

      if (reportIntent.reportKind === "top_items") {
        const itemMap = new Map<string, any>();
        for (const order of typedOrders) {
          for (const orderItem of order.order_items || []) {
            const name = orderItem.menu_items?.name || "Unknown Item";
            const quantity = Number(orderItem.quantity || 0);
            const existing = itemMap.get(name) || { item_name: name, quantity_sold: 0, order_count: 0 };
            existing.quantity_sold += quantity;
            existing.order_count += 1;
            itemMap.set(name, existing);
          }
        }
        const rankedItems = Array.from(itemMap.values())
          .sort((a, b) => (b.quantity_sold - a.quantity_sold) || (b.order_count - a.order_count))
          .slice(0, reportIntent.limit)
          .map((item, index) => ({ rank: index + 1, ...item }));

        if (rankedItems.length === 0) {
          return jsonResponse({ reply: `I could not find sold menu-item data for ${reportIntent.dateLabel} yet.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared your top-selling items PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "top_items",
            title: `Top ${rankedItems.length} Selling Items`,
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "rank", label: "Rank" },
              { key: "item_name", label: "Item" },
              { key: "quantity_sold", label: "Qty Sold" },
              { key: "order_count", label: "Orders Appeared In" },
            ],
            rows: rankedItems,
            generated_at: generatedAt,
            summary: {
              item_count: rankedItems.length,
              total_units: rankedItems.reduce((sum, item) => sum + Number(item.quantity_sold || 0), 0),
            },
          },
        });
      }

      if (reportIntent.reportKind === "sales_summary") {
        const totalRevenue = typedOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
        const averageOrderValue = typedOrders.length ? totalRevenue / typedOrders.length : 0;
        const statusCounts = ["paid", "preparing", "ready", "completed"].map((status) => ({
          status,
          order_count: typedOrders.filter((order) => order.status === status).length,
        }));

        return jsonResponse({
          reply: `I prepared a sales summary PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "sales_summary",
            title: "Sales Summary",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "status", label: "Status" },
              { key: "order_count", label: "Order Count" },
            ],
            rows: statusCounts,
            generated_at: generatedAt,
            summary: {
              order_count: typedOrders.length,
              total_revenue: Number(totalRevenue.toFixed(2)),
              average_order_value: Number(averageOrderValue.toFixed(2)),
            },
          },
        });
      }

      if (reportIntent.reportKind === "net_profit") {
        const grossRevenue = typedOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
        const totalExpenses = typedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const netProfit = grossRevenue - totalExpenses;
        const rows = [
          { metric: "Gross Revenue", amount: Number(grossRevenue.toFixed(2)) },
          { metric: "Logged Expenses", amount: Number(totalExpenses.toFixed(2)) },
          { metric: "Estimated Net Profit", amount: Number(netProfit.toFixed(2)) },
        ];
        return jsonResponse({
          reply: `I prepared a net profit PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "net_profit",
            title: "Net Profit Report",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "metric", label: "Metric" },
              { key: "amount", label: "Amount", format: "currency" },
            ],
            rows,
            generated_at: generatedAt,
            summary: {
              gross_revenue: Number(grossRevenue.toFixed(2)),
              total_expenses: Number(totalExpenses.toFixed(2)),
              estimated_net_profit: Number(netProfit.toFixed(2)),
            },
          },
        });
      }

      if (reportIntent.reportKind === "repeat_customers") {
        const buyersMap = new Map<string, any>();
        for (const order of typedOrders) {
          const key = `${order.customer_phone || ""}::${order.customer_name || ""}`;
          const existing = buyersMap.get(key) || {
            customer_name: order.customer_name || "Walk-in",
            customer_phone: order.customer_phone || "-",
            order_count: 0,
            total_spend: 0,
            first_order_at: order.created_at,
            latest_order_at: order.created_at,
          };
          existing.order_count += 1;
          existing.total_spend += Number(order.total_price || 0);
          if (new Date(order.created_at).getTime() < new Date(existing.first_order_at).getTime()) existing.first_order_at = order.created_at;
          if (new Date(order.created_at).getTime() > new Date(existing.latest_order_at).getTime()) existing.latest_order_at = order.created_at;
          buyersMap.set(key, existing);
        }

        const repeatRows = Array.from(buyersMap.values())
          .filter((buyer) => buyer.order_count > 1)
          .sort((a, b) => (b.order_count - a.order_count) || (b.total_spend - a.total_spend))
          .slice(0, reportIntent.limit)
          .map((buyer, index) => ({
            rank: index + 1,
            ...buyer,
            total_spend: Number(buyer.total_spend.toFixed(2)),
          }));

        if (repeatRows.length === 0) {
          return jsonResponse({ reply: `I could not find repeat customers in ${reportIntent.dateLabel} yet.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared a repeat-customer PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "repeat_customers",
            title: "Repeat Customer Report",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "rank", label: "Rank" },
              { key: "customer_name", label: "Customer" },
              { key: "customer_phone", label: "WhatsApp" },
              { key: "order_count", label: "Orders" },
              { key: "total_spend", label: "Total Spend", format: "currency" },
              { key: "latest_order_at", label: "Last Order", format: "date" },
            ],
            rows: repeatRows,
            generated_at: generatedAt,
            summary: {
              repeat_customer_count: repeatRows.length,
              repeat_revenue: Number(repeatRows.reduce((sum, buyer) => sum + buyer.total_spend, 0).toFixed(2)),
            },
          },
        });
      }

      if (reportIntent.reportKind === "unpaid_orders") {
        if (typedPendingOrders.length === 0) {
          return jsonResponse({ reply: `I could not find pending or unpaid orders for ${reportIntent.dateLabel}.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared an unpaid-orders PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "unpaid_orders",
            title: "Pending / Unpaid Orders",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "order_number", label: "Order #" },
              { key: "customer_name", label: "Customer" },
              { key: "customer_phone", label: "WhatsApp" },
              { key: "total_price", label: "Amount", format: "currency" },
              { key: "created_at", label: "Created", format: "date" },
              { key: "status", label: "Status" },
            ],
            rows: typedPendingOrders.map((order) => ({ ...order, total_price: Number(order.total_price || 0) })),
            generated_at: generatedAt,
            summary: {
              unpaid_order_count: typedPendingOrders.length,
              unpaid_value: Number(typedPendingOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0).toFixed(2)),
            },
          },
        });
      }

      if (reportIntent.reportKind === "expenses_summary") {
        if (typedExpenses.length === 0) {
          return jsonResponse({ reply: `I could not find expense records for ${reportIntent.dateLabel} yet.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared an expense summary PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "expenses_summary",
            title: "Expense Summary",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "expense_date", label: "Date", format: "date" },
              { key: "description", label: "Description" },
              { key: "amount", label: "Amount", format: "currency" },
            ],
            rows: typedExpenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
            generated_at: generatedAt,
            summary: {
              expense_count: typedExpenses.length,
              total_expenses: Number(typedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0).toFixed(2)),
            },
          },
        });
      }

      if (reportIntent.reportKind === "low_stock") {
        const lowStockRows = (ingredients || [])
          .filter((item: any) => Number(item.current_stock ?? 0) <= Number(item.low_stock_threshold ?? 5))
          .map((item: any) => ({
            ingredient_name: item.name,
            current_stock: Number(item.current_stock ?? 0),
            low_stock_threshold: Number(item.low_stock_threshold ?? 5),
            restock_rule: item.restock_input_quantity && item.restock_input_label && item.restock_output_quantity
              ? `${item.restock_input_quantity} ${item.restock_input_label} becomes ${item.restock_output_quantity}`
              : "Direct count",
          }));

        if (lowStockRows.length === 0) {
          return jsonResponse({ reply: `Good news: I could not find any low-stock items right now for ${reportIntent.dateLabel}.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared a low-stock PDF for ${vendor.name}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "low_stock",
            title: "Low Stock Report",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "ingredient_name", label: "Ingredient" },
              { key: "current_stock", label: "Current Stock" },
              { key: "low_stock_threshold", label: "Threshold" },
              { key: "restock_rule", label: "Restock Conversion" },
            ],
            rows: lowStockRows,
            generated_at: generatedAt,
            summary: {
              low_stock_count: lowStockRows.length,
            },
          },
        });
      }

      if (reportIntent.reportKind === "order_status") {
        const statusRows = ["paid", "preparing", "ready", "completed"].map((status) => {
          const matching = typedOrders.filter((order) => order.status === status);
          return {
            status,
            order_count: matching.length,
            revenue: Number(matching.reduce((sum, order) => sum + Number(order.total_price || 0), 0).toFixed(2)),
          };
        });

        return jsonResponse({
          reply: `I prepared an order-status PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "order_status",
            title: "Order Status Report",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "status", label: "Status" },
              { key: "order_count", label: "Orders" },
              { key: "revenue", label: "Revenue", format: "currency" },
            ],
            rows: statusRows,
            generated_at: generatedAt,
            summary: {
              order_count: typedOrders.length,
              ready_orders: typedOrders.filter((order) => order.status === "ready").length,
            },
          },
        });
      }

      if (reportIntent.reportKind === "kitchen_performance") {
        const rows = [
          { metric: "Orders sent to kitchen", value: typedOrders.filter((order) => ["preparing", "ready", "completed"].includes(order.status)).length },
          { metric: "Still preparing", value: typedOrders.filter((order) => order.status === "preparing").length },
          { metric: "Ready for collection", value: typedOrders.filter((order) => order.status === "ready").length },
          { metric: "Completed handoffs", value: typedOrders.filter((order) => order.status === "completed").length },
          { metric: "Customer arrived alerts", value: typedOrders.filter((order) => order.customer_arrived).length },
        ];
        return jsonResponse({
          reply: `I prepared a kitchen performance PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "kitchen_performance",
            title: "Kitchen Performance",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "metric", label: "Metric" },
              { key: "value", label: "Value" },
            ],
            rows,
            generated_at: generatedAt,
            summary: {
              kitchen_orders: rows[0].value,
              ready_orders: rows[2].value,
              completed_handoffs: rows[3].value,
            },
          },
        });
      }

      if (reportIntent.reportKind === "stock_usage_wastage") {
        if (typedAdjustments.length === 0) {
          return jsonResponse({ reply: `I could not find inventory adjustment activity for ${reportIntent.dateLabel}.`, pending_action: null });
        }

        const usageRows = typedAdjustments.map((entry) => ({
          created_at: entry.created_at,
          operation: entry.operation,
          quantity: Number(entry.quantity || 0),
          source: entry.source || "manual",
          note: entry.note || "-",
        }));

        const wasteCount = typedAdjustments.filter((entry) => /waste|wastage|damage/i.test(`${entry.note || ""} ${entry.source || ""}`)).length;

        return jsonResponse({
          reply: `I prepared a stock usage and wastage PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "stock_usage_wastage",
            title: "Stock Usage & Wastage",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "created_at", label: "Date", format: "date" },
              { key: "operation", label: "Operation" },
              { key: "quantity", label: "Quantity" },
              { key: "source", label: "Source" },
              { key: "note", label: "Note" },
            ],
            rows: usageRows,
            generated_at: generatedAt,
            summary: {
              adjustment_count: typedAdjustments.length,
              waste_flagged_entries: wasteCount,
            },
          },
        });
      }

      if (reportIntent.reportKind === "staff_performance") {
        if (typedAdjustments.length === 0 || actorIds.length === 0) {
          return jsonResponse({ reply: `I do not have enough staff activity data for ${reportIntent.dateLabel} yet. Staff reports currently rely on logged inventory adjustments.`, pending_action: null });
        }

        const staffMap = new Map<string, any>();
        for (const entry of typedAdjustments) {
          const actorId = entry.actor_user_id || "unknown";
          const profile = profilesById.get(actorId);
          const label = profile?.full_name || (actorId === "unknown" ? "Unassigned User" : "Staff User");
          const existing = staffMap.get(actorId) || {
            staff_name: label,
            role: profile?.role || "unknown",
            adjustment_count: 0,
            total_quantity_touched: 0,
          };
          existing.adjustment_count += 1;
          existing.total_quantity_touched += Number(entry.quantity || 0);
          staffMap.set(actorId, existing);
        }

        const staffRows = Array.from(staffMap.values())
          .sort((a, b) => (b.adjustment_count - a.adjustment_count) || (b.total_quantity_touched - a.total_quantity_touched))
          .map((entry, index) => ({
            rank: index + 1,
            ...entry,
            total_quantity_touched: Number(entry.total_quantity_touched.toFixed(2)),
          }));

        return jsonResponse({
          reply: `I prepared a staff activity PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "staff_performance",
            title: "Staff Activity Report",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "rank", label: "Rank" },
              { key: "staff_name", label: "Staff" },
              { key: "role", label: "Role" },
              { key: "adjustment_count", label: "Logged Actions" },
              { key: "total_quantity_touched", label: "Qty Touched" },
            ],
            rows: staffRows,
            generated_at: generatedAt,
            summary: {
              active_staff_count: staffRows.length,
              logged_actions: staffRows.reduce((sum, entry) => sum + Number(entry.adjustment_count || 0), 0),
            },
          },
        });
      }

      if (reportIntent.reportKind === "branch_performance") {
        const branchMap = new Map<string, any>();
        for (const order of typedOrders) {
          const locationName = order.locations?.name || "Unassigned";
          const existing = branchMap.get(locationName) || {
            branch_name: locationName,
            order_count: 0,
            revenue: 0,
          };
          existing.order_count += 1;
          existing.revenue += Number(order.total_price || 0);
          branchMap.set(locationName, existing);
        }

        const branchRows = Array.from(branchMap.values())
          .sort((a, b) => (b.revenue - a.revenue) || (b.order_count - a.order_count))
          .map((branch, index) => ({
            rank: index + 1,
            ...branch,
            revenue: Number(branch.revenue.toFixed(2)),
          }));

        if (branchRows.length === 0) {
          return jsonResponse({ reply: `I could not find enough branch-linked order data for ${reportIntent.dateLabel}.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared a branch performance PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "branch_performance",
            title: "Branch Performance",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "rank", label: "Rank" },
              { key: "branch_name", label: "Branch" },
              { key: "order_count", label: "Orders" },
              { key: "revenue", label: "Revenue", format: "currency" },
            ],
            rows: branchRows,
            generated_at: generatedAt,
            summary: {
              branch_count: branchRows.length,
              total_revenue: Number(branchRows.reduce((sum, branch) => sum + branch.revenue, 0).toFixed(2)),
            },
          },
        });
      }

      if (reportIntent.reportKind === "reservations_summary") {
        if (typedReservations.length === 0) {
          return jsonResponse({ reply: `I could not find reservation activity for ${reportIntent.dateLabel} yet.`, pending_action: null });
        }

        return jsonResponse({
          reply: `I prepared a reservations PDF for ${reportIntent.dateLabel}.`,
          pending_action: {
            type: "pdf_report",
            report_kind: "reservations_summary",
            title: "Reservations Summary",
            subtitle: reportIntent.dateLabel,
            columns: [
              { key: "reservation_date", label: "Date", format: "date" },
              { key: "reservation_time", label: "Time" },
              { key: "customer_name", label: "Customer" },
              { key: "reservation_type", label: "Type" },
              { key: "guest_count", label: "Guests" },
              { key: "status", label: "Status" },
            ],
            rows: typedReservations,
            generated_at: generatedAt,
            summary: {
              reservation_count: typedReservations.length,
              confirmed_count: typedReservations.filter((reservation) => reservation.status === "confirmed").length,
              pending_count: typedReservations.filter((reservation) => reservation.status === "pending").length,
              venue_bookings: typedReservations.filter((reservation) => reservation.reservation_type === "venue").length,
            },
          },
        });
      }
    }

    const { data: recentReservations } = !isInventoryStaff
      ? await supabase
          .from("reservations")
          .select("reservation_type, status, customer_name, guest_count, reservation_date, reservation_time")
          .eq("vendor_id", vendorId)
          .order("reservation_date", { ascending: true })
          .limit(30)
      : { data: [] };

    const prompt = JSON.stringify({
      task:
        isInventoryStaff
          ? "Act like an inventory manager for the vendor. Answer using only the provided ingredient and stock data. Be concise, practical, and specific. You can help with restocking, shortages, wastage, and stock priorities. If the user asks about revenue, customers, billing, or private owner settings, say this staff mode only handles inventory operations."
          : "Act like an operations manager for the vendor. Answer the user's question using only the provided data. Be concise, practical, and specific. If data is missing, say so plainly. Focus on orders, reservations, revenue, stock, menu performance, and support load.",
      vendor: {
        id: vendor.id,
        name: vendor.name,
      },
      shop_snapshot: {
        total_revenue: totalRevenue,
        active_order_count: activeOrders.length,
        ready_order_count: activeOrders.filter((o: any) => o.status === "ready").length,
        low_stock_count: lowStock.length,
        pending_reservation_count: (recentReservations || []).filter((reservation: any) => reservation.status === "pending").length,
        upcoming_reservation_count: (recentReservations || []).filter((reservation: any) => ["pending", "confirmed"].includes(reservation.status)).length,
      },
      recent_orders: orders || [],
      recent_reservations: recentReservations || [],
      low_stock_items: lowStock,
      recent_expenses: expenses || [],
      menu_items: menuItems || [],
      recent_messages: messages.slice(-8),
      latest_user_message: message,
    });

    const groqOrGrokApiKey = vendor.payment_config?.groq_api_key || vendor.payment_config?.grok_api_key;
    const geminiApiKey = vendor.payment_config?.gemini_api_key;

    let reply = "";

    if (groqOrGrokApiKey) {
      reply = groqOrGrokApiKey.startsWith("gsk_")
        ? await callGroqCloud(groqOrGrokApiKey, prompt).catch(() => "")
        : await callXaiGrok(groqOrGrokApiKey, prompt).catch(() => "");
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
