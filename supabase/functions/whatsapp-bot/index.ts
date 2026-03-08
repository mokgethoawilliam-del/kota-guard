import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables configured in Supabase Edge Functions
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'kota_guard_secret_token_123';
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
    const url = new URL(req.url);

    // 1. Meta Webhook Verification (GET request)
    if (req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
            console.log('Webhook verified successfully!');
            return new Response(challenge, { status: 200 });
        } else {
            return new Response('Forbidden', { status: 403 });
        }
    }

    // 2. Handling Incoming Messages (POST request)
    if (req.method === 'POST') {
        try {
            const body = await req.json();

            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry) {
                    for (const change of entry.changes) {
                        if (change.value && change.value.messages && change.value.messages[0]) {

                            const phone_number_id = change.value.metadata.phone_number_id;
                            const from = change.value.messages[0].from; // sender's phone number

                            // Ensure texts have body, otherwise it might be a button click or other interactive message type
                            if (change.value.messages[0].type !== 'text') {
                                continue;
                            }
                            const msg_body = change.value.messages[0].text.body.trim();

                            console.log(`Received message from ${from}: ${msg_body}`);

                            // --- CONVERSATIONAL BOT LOGIC ---

                            // 1. Fetch live menu from database
                            const { data: menuItems, error: menuErr } = await supabase
                                .from('menu_items')
                                .select('*')
                                .order('id');

                            if (menuErr || !menuItems) {
                                await sendWhatsAppMessage(phone_number_id, from, "Sorry, our menu is currently unavailable. Please try again later.");
                                return new Response('EVENT_RECEIVED', { status: 200 });
                            }

                            // 2. Check if the input is a number matching a menu item
                            const selectionIndex = parseInt(msg_body) - 1;
                            const selectedItem = menuItems[selectionIndex];

                            if (!isNaN(selectionIndex) && selectedItem) {
                                // User made a valid selection! Generate a Paystack link.
                                await sendWhatsAppMessage(phone_number_id, from, `Great choice! Preparing your order for ${selectedItem.name}...`);

                                try {
                                    // A. Create a "pending" order in database
                                    const tempOrderNumber = `WA-${Date.now().toString().slice(-4)}`;
                                    const { data: order, error: orderErr } = await supabase
                                        .from('orders')
                                        .insert({
                                            status: 'pending',
                                            order_number: tempOrderNumber,
                                            customer_name: 'WhatsApp Customer',
                                            customer_phone: from,
                                            total_price: selectedItem.price,
                                            // Defaults to the first location for the MVP bot
                                            location_id: '11111111-1111-1111-1111-111111111111'
                                        })
                                        .select()
                                        .single();

                                    if (orderErr) throw orderErr;

                                    // B. Link the item
                                    const { error: itemErr } = await supabase
                                        .from('order_items')
                                        .insert({
                                            order_id: order.id,
                                            menu_item_id: selectedItem.id,
                                            quantity: 1,
                                            price_at_time: selectedItem.price,
                                        });

                                    if (itemErr) throw itemErr;

                                    // C. Call Paystack API to Generate Payment Link
                                    const paystackUrl = 'https://api.paystack.co/transaction/initialize';
                                    const payResponse = await fetch(paystackUrl, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            email: `${from}@whatsapp.kotaguard.com`,
                                            amount: Math.round(selectedItem.price * 100), // in cents
                                            currency: 'ZAR',
                                            metadata: {
                                                order_id: order.id,
                                                source: 'whatsapp_bot'
                                            }
                                        })
                                    });

                                    const payData = await payResponse.json();
                                    if (payData.status) {
                                        const paymentLink = payData.data.authorization_url;
                                        await sendWhatsAppMessage(phone_number_id, from, `🍔 Please pay securely using this link to confirm your order:\n\n🔗 ${paymentLink}\n\nOnce paid, you'll receive your collection number instantly!`);
                                    } else {
                                        throw new Error("Paystack link generation failed: " + payData.message);
                                    }

                                } catch (checkoutErr) {
                                    console.error(checkoutErr);
                                    await sendWhatsAppMessage(phone_number_id, from, "Sorry, we encountered an error setting up your payment. Please try again.");
                                }

                            }
                            // 3. Render the Menu if input is not a valid number (e.g. "Hi", "Menu", invalid number)
                            else {
                                let menuString = "👋 Welcome to Kota Guard! What would you like to order today?\n\n";
                                menuItems.forEach((item, index) => {
                                    menuString += `*${index + 1}.* ${item.name} (R${item.price})\n`;
                                });
                                menuString += "\nReply with the *number* of your choice.";

                                await sendWhatsAppMessage(phone_number_id, from, menuString);
                            }
                        }
                    }
                }
                return new Response('EVENT_RECEIVED', { status: 200 });
            } else {
                return new Response('Not Found', { status: 404 });
            }
        } catch (e) {
            console.error(e);
            return new Response('Internal Server Error', { status: 500 });
        }
    }

    return new Response('Method Not Allowed', { status: 405 });
});

// Helper function to send messages back via Meta Cloud API
async function sendWhatsAppMessage(phone_number_id: string, to: string, message: string) {
    if (!WHATSAPP_API_TOKEN) {
        console.error("Missing WHATSAPP_API_TOKEN in environment variables.");
        return;
    }

    const url = `https://graph.facebook.com/v17.0/${phone_number_id}/messages`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to,
            type: "text",
            text: { body: message }
        })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("Failed to send WhatsApp message:", data);
    } else {
        console.log("Message sent successfully to", to);
    }
}
