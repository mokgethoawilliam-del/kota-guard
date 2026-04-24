import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_VERIFY_TOKEN =
  Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "kota_guard_secret_token_123";
const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified successfully.");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    if (body.object !== "whatsapp_business_account") {
      return new Response("Not Found", { status: 404 });
    }

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (!change.value?.messages?.[0]) continue;

        const phoneNumberId = change.value.metadata.phone_number_id;
        const message = change.value.messages[0];
        const from = message.from;

        const { data: vendor, error: vendorError } = await supabase
          .from("kg_vendors")
          .select("*")
          .eq("whatsapp_config->>phone_number_id", phoneNumberId)
          .single();

        let activeVendor = vendor;
        if (vendorError || !vendor) {
          console.log(
            `No vendor found for phone_id ${phoneNumberId}. Falling back to default vendor.`
          );
          const { data: defaultVendor } = await supabase
            .from("kg_vendors")
            .select("*")
            .eq("slug", "chef-dips")
            .single();
          activeVendor = defaultVendor;
        }

        if (!activeVendor) {
          console.error("No active vendor found for this WhatsApp bot instance.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (message.type !== "text") continue;

        const msgBody = message.text.body.trim();
        const vendorToken =
          activeVendor.whatsapp_config?.api_token || WHATSAPP_API_TOKEN;

        console.log(
          `[Vendor: ${activeVendor.name}] Received message from ${from}: ${msgBody}`
        );

        const { data: sessionData } = await supabase
          .from("kg_bot_sessions")
          .select("*")
          .eq("phone_number", from)
          .single();

        const userState = sessionData?.state || "IDLE";

        const { data: menuItems, error: menuError } = await supabase
          .from("kg_menu_items")
          .select("*")
          .eq("vendor_id", activeVendor.id)
          .order("id");

        if (menuError || !menuItems) {
          await sendWhatsAppMessage(
            phoneNumberId,
            from,
            "Sorry, our menu is currently unavailable. Please try again later.",
            vendorToken
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (userState === "IDLE") {
          const selectionIndex = parseInt(msgBody, 10) - 1;
          const selectedItem = menuItems[selectionIndex];

          if (!Number.isNaN(selectionIndex) && selectedItem) {
            try {
              const tempOrderNumber = `WA-${Date.now().toString().slice(-4)}`;
              const { data: locations } = await supabase
                .from("kg_locations")
                .select("id")
                .eq("vendor_id", activeVendor.id)
                .limit(1);
              const locationId =
                activeVendor.whatsapp_config?.default_location_id ||
                locations?.[0]?.id ||
                null;

              const { data: order, error: orderError } = await supabase
                .from("kg_orders")
                .insert({
                  vendor_id: activeVendor.id,
                  status: "pending",
                  order_number: tempOrderNumber,
                  customer_name: "WhatsApp Customer",
                  customer_phone: from,
                  total_price: selectedItem.price,
                  location_id: locationId,
                })
                .select()
                .single();

              if (orderError) throw orderError;

              await supabase.from("kg_order_items").insert({
                order_id: order.id,
                menu_item_id: selectedItem.id,
                quantity: 1,
                price_at_time: selectedItem.price,
              });

              await supabase.from("kg_bot_sessions").upsert({
                phone_number: from,
                vendor_id: activeVendor.id,
                state: "AWAITING_PAYMENT_METHOD",
                last_order_id: order.id,
                updated_at: new Date().toISOString(),
              });

              await sendWhatsAppMessage(
                phoneNumberId,
                from,
                `Great choice: ${selectedItem.name}!\n\nHow would you like to pay?\n1. *Card / EFT (Paystack)*\n2. *1Voucher (Unavailable)*`,
                vendorToken
              );
            } catch (error) {
              console.error(error);
              await sendWhatsAppMessage(
                phoneNumberId,
                from,
                "Error processing your order.",
                vendorToken
              );
            }
          } else {
            let menuString = `Welcome to ${activeVendor.name}! What would you like to order today?\n\n`;
            menuItems.forEach((item: any, index: number) => {
              menuString += `*${index + 1}.* ${item.name} (R${item.price})\n`;
            });
            menuString += "\nReply with the *number* of your choice.";
            await sendWhatsAppMessage(phoneNumberId, from, menuString, vendorToken);
          }
        } else if (userState === "AWAITING_PAYMENT_METHOD") {
          if (msgBody === "1") {
            const { data: order } = await supabase
              .from("kg_orders")
              .select("*")
              .eq("id", sessionData.last_order_id)
              .single();

            const vendorSecret =
              activeVendor.payment_config?.paystack_secret_key ||
              activeVendor.paystack_secret_key;

            if (!vendorSecret) {
              await sendWhatsAppMessage(
                phoneNumberId,
                from,
                "Payment service is currently unavailable.",
                vendorToken
              );
              return new Response("EVENT_RECEIVED", { status: 200 });
            }

            const payResponse = await fetch(
              "https://api.paystack.co/transaction/initialize",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${vendorSecret}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email: `${from}@whatsapp.kotaguard.com`,
                  amount: Math.round(order.total_price * 100),
                  currency: "ZAR",
                  metadata: {
                    order_id: order.id,
                    vendor_id: activeVendor.id,
                    source: "whatsapp_bot",
                  },
                }),
              }
            );

            const payData = await payResponse.json();
            if (payData.status) {
              await sendWhatsAppMessage(
                phoneNumberId,
                from,
                `Pay securely here to confirm:\n${payData.data.authorization_url}`,
                vendorToken
              );
              await supabase
                .from("kg_bot_sessions")
                .upsert({ phone_number: from, state: "IDLE" });
            } else {
              await sendWhatsAppMessage(
                phoneNumberId,
                from,
                "Payment service is currently unavailable.",
                vendorToken
              );
            }
          } else if (msgBody === "2") {
            await sendWhatsAppMessage(
              phoneNumberId,
              from,
              "Voucher payments are currently unavailable. Please reply with *1* to pay by card instead.",
              vendorToken
            );
          } else {
            await sendWhatsAppMessage(
              phoneNumberId,
              from,
              "Please reply with *1* for Card.",
              vendorToken
            );
          }
        } else if (userState === "AWAITING_VOUCHER_PIN") {
          const pin = msgBody.replace(/\D/g, "");
          if (pin.length === 16) {
            await sendWhatsAppMessage(
              phoneNumberId,
              from,
              "Voucher payments are currently unavailable. Please reply with *1* to pay by card instead.",
              vendorToken
            );
            await supabase.from("kg_bot_sessions").upsert({
              phone_number: from,
              vendor_id: activeVendor.id,
              state: "AWAITING_PAYMENT_METHOD",
              last_order_id: sessionData.last_order_id,
              updated_at: new Date().toISOString(),
            });
          } else {
            await sendWhatsAppMessage(
              phoneNumberId,
              from,
              "That does not look like a 16-digit PIN. Please re-enter your 16-digit 1Voucher PIN.",
              vendorToken
            );
          }
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  message: string,
  apiToken?: string
) {
  const token = apiToken || WHATSAPP_API_TOKEN;
  if (!token) {
    console.error("Missing WhatsApp API token.");
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("Failed to send WhatsApp message:", data);
  } else {
    console.log("Message sent successfully to", to);
  }
}
