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
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
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
            "You are a senior landing-page copywriter and brand strategist for hospitality, food, restaurant, cafe, venue, and takeaway businesses. Return concise, commercially useful outputs only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok request failed: ${await response.text()}`);
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
            "You are a senior landing-page copywriter and brand strategist for hospitality, food, restaurant, cafe, venue, and takeaway businesses. Return concise, commercially useful outputs only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`GroqCloud request failed: ${await response.text()}`);
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
          temperature: 0.4,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function isRestaurantLike(prompt: string, menuNames: string[]) {
  const text = `${prompt} ${menuNames.join(" ")}`.toLowerCase();
  return /\b(restaurant|grill|lounge|table|reservation|booking|venue|dining|private event|date night|chef)\b/.test(text);
}

function buildFallbackDraft(vendorName: string, prompt: string, currentBranding: Record<string, any>, menuNames: string[]) {
  const restaurantLike = isRestaurantLike(prompt, menuNames);
  const primaryColor = /^#[0-9a-f]{6}$/i.test(String(currentBranding?.primary_color || "").trim())
    ? String(currentBranding.primary_color).trim()
    : restaurantLike
      ? "#c2410c"
      : "#0f766e";

  return {
    tagline: restaurantLike ? "Memorable Dining & Gatherings" : "Fresh Flavour, Thoughtful Service",
    welcome_text: restaurantLike ? "Reserve, dine, and celebrate with us" : "Welcome to a better food experience",
    hero_title: restaurantLike ? "Great meals for" : "Fresh food for",
    hero_highlight: restaurantLike ? "shared moments." : "every appetite.",
    hero_subtitle: restaurantLike
      ? "Book a table, plan a gathering, or order with confidence from a brand that knows hospitality."
      : "Browse the menu, order online, and enjoy a smooth customer experience from the first click.",
    about_text: restaurantLike
      ? `${vendorName} brings together flavour, atmosphere, and warm service for everyday dining and special occasions alike.`
      : `${vendorName} is built around quality food, clear service, and a welcoming experience that feels polished without losing warmth.`,
    primary_color: primaryColor,
    design_direction: restaurantLike
      ? "Use a rich, welcoming hero image with visible tables, plating, or ambience. Keep the logo prominent, let the booking CTA feel first-class, and use the accent color sparingly for premium contrast."
      : "Use a clean, appetizing hero image with strong food photography. Keep the message short, the CTA obvious, and the overall look bright, confident, and trustworthy.",
  };
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
    if (!authHeader) return jsonResponse({ error: "Missing authorization header" }, 401);

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

    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { vendorId, prompt, currentBranding = {}, vendorName } = await req.json();
    if (!vendorId || !prompt?.trim()) {
      return jsonResponse({ error: "Missing vendorId or prompt" }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("vendor_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.vendor_id !== vendorId || !["owner", "admin"].includes(profile.role)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, name, payment_config, branding")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      return jsonResponse({ error: "Vendor not found" }, 404);
    }

    const { data: locations } = await supabase
      .from("locations")
      .select("name, is_mobile")
      .eq("vendor_id", vendorId)
      .eq("is_active", true)
      .limit(10);

    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("name, description, price")
      .eq("vendor_id", vendorId)
      .limit(12);

    const safeVendorName = String(vendorName || vendor.name || "This business");
    const menuNames = (menuItems || []).map((item: any) => item.name).filter(Boolean);

    const aiPrompt = `
You are drafting landing-page CMS copy for a real business admin.

Return STRICT JSON only with this exact shape:
{
  "reply": "one short sentence describing the direction you took",
  "draft": {
    "tagline": "max 5 words",
    "welcome_text": "short eyebrow text",
    "hero_title": "main hero lead-in without the highlighted tail",
    "hero_highlight": "short highlighted tail phrase",
    "hero_subtitle": "one sentence under the hero",
    "about_text": "2-3 sentence about section copy",
    "primary_color": "#RRGGBB",
    "design_direction": "2-3 sentences about visual direction and image choice"
  }
}

Rules:
- Keep the copy adaptable for hospitality and food businesses.
- Do not mention kota unless the user explicitly asks for it.
- Do not mention AI, SaaS, dashboards, or technology.
- If the prompt suggests bookings, tables, events, or venue hire, let the copy support that naturally.
- Keep it polished, commercially useful, and not cheesy.
- Hero title and highlight should read naturally together on one line.
- Primary color must be a valid 6-digit hex code.

Business name: ${safeVendorName}
Current branding: ${JSON.stringify(currentBranding || {})}
Active locations: ${JSON.stringify(locations || [])}
Menu sample: ${JSON.stringify(menuItems || [])}
User request: ${prompt}
`.trim();

    const groqOrGrokApiKey = vendor.payment_config?.grok_api_key;
    const geminiApiKey = vendor.payment_config?.gemini_api_key;

    let rawReply = "";
    if (groqOrGrokApiKey) {
      rawReply = groqOrGrokApiKey.startsWith("gsk_")
        ? await callGroqCloud(groqOrGrokApiKey, aiPrompt).catch(() => "")
        : await callXaiGrok(groqOrGrokApiKey, aiPrompt).catch(() => "");
    }
    if (!rawReply && geminiApiKey) {
      rawReply = await callGemini(geminiApiKey, aiPrompt).catch(() => "");
    }

    let parsed: any = null;
    if (rawReply) {
      try {
        parsed = JSON.parse(normalizeJson(rawReply));
      } catch {
        parsed = null;
      }
    }

    const fallbackDraft = buildFallbackDraft(safeVendorName, prompt, currentBranding, menuNames);
    const draft = {
      ...fallbackDraft,
      ...(parsed?.draft || {}),
    };

    if (!/^#[0-9a-f]{6}$/i.test(String(draft.primary_color || "").trim())) {
      draft.primary_color = fallbackDraft.primary_color;
    }

    return jsonResponse({
      reply:
        parsed?.reply ||
        "I drafted a landing-page direction you can review and apply into your CMS fields.",
      draft,
    });
  } catch (error) {
    console.error("website-cms-copilot error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
