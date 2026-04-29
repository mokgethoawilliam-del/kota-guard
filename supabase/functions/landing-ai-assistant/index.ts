import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type DraftCartItem = {
  menu_item_id: string;
  quantity: number;
};

type OrderLookupResult = {
  order_number: string;
  status: string;
  total_price: number;
  created_at: string;
  location_name: string | null;
  customer_arrived: boolean;
};

type AssistantPayload = {
  vendorId?: string;
  message?: string;
  messages?: ChatMessage[];
  draftCart?: DraftCartItem[];
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

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(normalizeJson(value)) as T;
  } catch {
    return null;
  }
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "");
}

function detectTrackingIdentifier(message: string) {
  const normalized = normalizePhone(message);
  const orderMatch = message.match(/[a-z]{2,5}\/\d{4}\/\d{3,}/i) || message.match(/\bPND-\d{4,}\b/i);
  if (orderMatch) {
    return { kind: "order_number", value: orderMatch[0] };
  }

  const phoneMatch = normalized.match(/(?:\+27|0)[6-8][0-9]{8}/);
  if (phoneMatch) {
    return { kind: "customer_phone", value: phoneMatch[0] };
  }

  return null;
}

function getOrderStatusLabel(status: string, customerArrived: boolean) {
  if (status === "paid" || status === "new") return "Order sent to kitchen";
  if (status === "preparing") return "Chef is preparing your order";
  if (status === "ready" && !customerArrived) return "Ready for collection";
  if (status === "ready" && customerArrived) return "Shop has been told you arrived";
  if (status === "completed") return "Completed";
  if (status === "refunded") return "Refunded or cancelled";
  return "Verifying";
}

function fallbackReply(args: {
  vendorName: string;
  message: string;
  menuItems: Array<{ id: string; name: string; price: number }>;
  locations: Array<{ name: string; office_hours?: string | null }>;
}) {
  const lower = args.message.toLowerCase();

  if (lower.includes("human") || lower.includes("agent") || lower.includes("support")) {
    return {
      reply: `I’m handing this over to ${args.vendorName}'s support team now.`,
      handoff_to_support: true,
      suggested_action: "support",
      draft_cart: [] as DraftCartItem[],
    };
  }

  if (lower.includes("where") || lower.includes("branch") || lower.includes("location")) {
    const branches = args.locations.slice(0, 3).map((loc) => {
      const hours = loc.office_hours ? ` (${loc.office_hours})` : "";
      return `${loc.name}${hours}`;
    });
    return {
      reply: branches.length
        ? `Here are the available collection points: ${branches.join(", ")}.`
        : `I can help with menu and ordering, but I do not have location details for ${args.vendorName} right now.`,
      handoff_to_support: false,
      suggested_action: "browse",
      draft_cart: [] as DraftCartItem[],
    };
  }

  if (lower.includes("cheap") || lower.includes("under") || lower.includes("price")) {
    const cheapest = [...args.menuItems].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 3);
    return {
      reply: cheapest.length
        ? `Here are some good options: ${cheapest.map((item) => `${item.name} (R${item.price})`).join(", ")}.`
        : `I can help with menu questions, but I do not have menu items loaded for ${args.vendorName} right now.`,
      handoff_to_support: false,
      suggested_action: "browse",
      draft_cart: [] as DraftCartItem[],
    };
  }

  return {
    reply: `I can help you browse the menu, build an order, or connect you to ${args.vendorName}'s support team. Tell me what you'd like to order.`,
    handoff_to_support: false,
    suggested_action: "browse",
    draft_cart: [] as DraftCartItem[],
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
            "You are a careful ordering assistant for a restaurant storefront. Always return strict JSON only.",
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
            "You are a careful ordering assistant for a restaurant storefront. Always return strict JSON only.",
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              reply: { type: "string" },
              handoff_to_support: { type: "boolean" },
              suggested_action: { type: "string" },
              draft_cart: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    menu_item_id: { type: "string" },
                    quantity: { type: "integer" },
                  },
                  required: ["menu_item_id", "quantity"],
                },
              },
            },
            required: ["reply", "handoff_to_support", "suggested_action", "draft_cart"],
          },
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
    const { vendorId, message, messages = [], draftCart = [] } = (await req.json()) as AssistantPayload;

    if (!vendorId || !message?.trim()) {
      return jsonResponse({ error: "Missing vendorId or message" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [{ data: vendor }, { data: allMenuItems }, { data: locations }] = await Promise.all([
      supabase
        .from("vendors")
        .select("id, name, branding, payment_config")
        .eq("id", vendorId)
        .single(),
      supabase
        .from("menu_items")
        .select("id, name, price, is_available")
        .eq("vendor_id", vendorId)
        .order("price"),
      supabase
        .from("locations")
        .select("id, name, office_hours, is_active")
        .eq("vendor_id", vendorId)
        .eq("is_active", true),
    ]);

    if (!vendor) {
      return jsonResponse({ error: "Vendor not found" }, 404);
    }

    const menuItems = (allMenuItems || []).filter((item) => item.is_available !== false);
    const effectiveMenuItems = menuItems.length > 0 ? menuItems : (allMenuItems || []);

    const recentMessages = messages.slice(-8);
    const prompt = JSON.stringify({
      task:
        "Return JSON only. Help the customer browse the menu, build a draft order, answer business questions from provided data, or help with safe order tracking. Never invent menu items, prices, locations, or order states. If the customer asks about an existing order, try to extract an exact order number or WhatsApp number into tracking_identifier and tracking_kind. If no tracking identifier is present, ask for it. If the request is about refunds, payment disputes, or anything sensitive, set handoff_to_support=true. If the user wants to order, use only the provided menu_item_id values in draft_cart. Keep the reply short and helpful.",
      vendor: {
        name: vendor.name,
        branding: vendor.branding || {},
      },
      menu_items: effectiveMenuItems.map((item) => ({
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
      })),
      locations: (locations || []).map((loc) => ({
        id: loc.id,
        name: loc.name,
        office_hours: loc.office_hours,
      })),
      current_draft_cart: draftCart,
      recent_messages: recentMessages,
      latest_customer_message: message,
      json_schema: {
        reply: "string",
        handoff_to_support: "boolean",
        suggested_action: "browse | checkout | support | track_order",
        draft_cart: [{ menu_item_id: "string", quantity: "integer" }],
        tracking_identifier: "string | empty",
        tracking_kind: "order_number | customer_phone | empty",
      },
    });

    const groqOrGrokApiKey = vendor.payment_config?.groq_api_key || vendor.payment_config?.grok_api_key;
    const geminiApiKey = vendor.payment_config?.gemini_api_key;

    let assistantResult:
      | {
          reply: string;
          handoff_to_support: boolean;
          suggested_action: string;
          draft_cart: DraftCartItem[];
          tracking_identifier?: string;
          tracking_kind?: string;
        }
      | null = null;

    if (groqOrGrokApiKey) {
      const providerText = groqOrGrokApiKey.startsWith("gsk_")
        ? await callGroqCloud(groqOrGrokApiKey, prompt).catch(() => "")
        : await callXaiGrok(groqOrGrokApiKey, prompt).catch(() => "");
      assistantResult = providerText ? safeParseJson<typeof assistantResult>(providerText) : null;
    }

    if (!assistantResult && geminiApiKey) {
      const geminiText = await callGemini(geminiApiKey, prompt).catch(() => "");
      assistantResult = geminiText ? safeParseJson<typeof assistantResult>(geminiText) : null;
    }

    if (!assistantResult) {
      assistantResult = fallbackReply({
        vendorName: vendor.name,
        message,
        menuItems: effectiveMenuItems.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
        })),
        locations: locations || [],
      });
    }

    const validMenuIds = new Set(effectiveMenuItems.map((item) => item.id));
    const sanitizedDraftCart = Array.isArray(assistantResult.draft_cart)
      ? assistantResult.draft_cart
          .filter((item) => validMenuIds.has(item.menu_item_id))
          .map((item) => ({
            menu_item_id: item.menu_item_id,
            quantity: Math.max(1, Math.min(20, Number(item.quantity) || 1)),
          }))
      : [];

    let orderLookup: OrderLookupResult[] = [];
    const detectedTracking =
      (assistantResult?.tracking_identifier && assistantResult?.tracking_kind
        ? {
            kind: assistantResult.tracking_kind,
            value: assistantResult.tracking_identifier,
          }
        : null) || detectTrackingIdentifier(message);

    if (
      (assistantResult?.suggested_action === "track_order" || detectedTracking) &&
      detectedTracking?.value
    ) {
      let lookupQuery = supabase
        .from("orders")
        .select("order_number, status, total_price, created_at, customer_arrived, locations(name)")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .limit(detectedTracking.kind === "customer_phone" ? 3 : 1);

      if (detectedTracking.kind === "order_number") {
        lookupQuery = lookupQuery.eq("order_number", detectedTracking.value);
      } else if (detectedTracking.kind === "customer_phone") {
        lookupQuery = lookupQuery.eq("customer_phone", normalizePhone(detectedTracking.value));
      }

      const { data: orderRows } = await lookupQuery;
      orderLookup = (orderRows || []).map((row: any) => ({
        order_number: row.order_number,
        status: row.status,
        total_price: Number(row.total_price),
        created_at: row.created_at,
        location_name: row.locations?.name || null,
        customer_arrived: Boolean(row.customer_arrived),
      }));

      if (orderLookup.length > 0) {
        const summary = orderLookup
          .map((order) => {
            const where = order.location_name ? ` at ${order.location_name}` : "";
            return `${order.order_number}: ${getOrderStatusLabel(order.status, order.customer_arrived)}${where}`;
          })
          .join(" | ");

        assistantResult.reply = `${assistantResult.reply} ${summary}`.trim();
      } else if (
        assistantResult?.suggested_action === "track_order" ||
        detectedTracking.kind === "order_number" ||
        detectedTracking.kind === "customer_phone"
      ) {
        assistantResult.reply =
          "I could not find a matching order for that vendor yet. Please double-check the order number or WhatsApp number, or ask me to connect you to support.";
      }
    }

    return jsonResponse({
      reply: assistantResult.reply,
      handoff_to_support: Boolean(assistantResult.handoff_to_support),
      suggested_action: assistantResult.suggested_action || "browse",
      draft_cart: sanitizedDraftCart,
      order_lookup: orderLookup,
    });
  } catch (error) {
    console.error("landing-ai-assistant error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
