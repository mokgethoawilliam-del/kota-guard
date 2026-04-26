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

    const { vendorId, ingredientId, operation, quantity, note } = await req.json();
    if (!vendorId || !ingredientId || !operation || typeof quantity === "undefined") {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await authedSupabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("vendor_id, role")
      .eq("id", user.id)
      .single();

    const allowedRoles = new Set(["owner", "admin", "inventory_staff"]);

    if (!profile || profile.vendor_id !== vendorId || !allowedRoles.has(String(profile.role || ""))) {
      return jsonResponse({ error: "Forbidden for this vendor" }, 403);
    }

    const normalizedOperation = String(operation);
    const numericQuantity = Number(quantity);
    if (!["increase_stock", "decrease_stock", "set_stock_exactly"].includes(normalizedOperation) || Number.isNaN(numericQuantity)) {
      return jsonResponse({ error: "Invalid operation or quantity" }, 400);
    }

    const { data: ingredient, error: ingredientError } = await adminSupabase
      .from("ingredients")
      .select("id, vendor_id, name, current_stock")
      .eq("id", ingredientId)
      .eq("vendor_id", vendorId)
      .single();

    if (ingredientError || !ingredient) {
      return jsonResponse({ error: "Ingredient not found" }, 404);
    }

    const previousStock = Number(ingredient.current_stock ?? 0);
    let newStock = previousStock;

    if (normalizedOperation === "increase_stock") {
      newStock = previousStock + numericQuantity;
    } else if (normalizedOperation === "decrease_stock") {
      newStock = Math.max(0, previousStock - numericQuantity);
    } else if (normalizedOperation === "set_stock_exactly") {
      newStock = Math.max(0, numericQuantity);
    }

    const { data: updatedIngredient, error: updateError } = await adminSupabase
      .from("ingredients")
      .update({ current_stock: newStock })
      .eq("id", ingredient.id)
      .eq("vendor_id", vendorId)
      .select("id, name, current_stock, low_stock_threshold, restock_input_label, restock_input_quantity, restock_output_quantity")
      .single();

    if (updateError || !updatedIngredient) {
      return jsonResponse({ error: "Could not update ingredient" }, 500);
    }

    await adminSupabase.from("inventory_adjustments").insert({
      vendor_id: vendorId,
      ingredient_id: ingredient.id,
      actor_user_id: user.id,
      operation: normalizedOperation,
      quantity: numericQuantity,
      previous_stock: previousStock,
      new_stock: newStock,
      note: note || null,
      source: "ai_manager",
    });

    return jsonResponse({
      ingredient: updatedIngredient,
      previous_stock: previousStock,
      new_stock: newStock,
    });
  } catch (error) {
    console.error("apply-inventory-adjustment error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
