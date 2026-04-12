import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables configured in Supabase Edge Functions
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'kota_guard_secret_token_123';
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
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
                            const from = change.value.messages[0].from; 

                            // --- MULTI-TENANT VENDOR LOOKUP ---
                            // Find the vendor associated with this phone_number_id
                            const { data: vendor, error: vErr } = await supabase
                                .from('vendors')
                                .select('*')
                                .eq('whatsapp_config->>phone_number_id', phone_number_id)
                                .single();

                            // Fallback for Chef Dips if not explicitly linked or migration hasn't finished
                            let activeVendor = vendor;
                            if (vErr || !vendor) {
                                console.log(`No vendor found for phone_id ${phone_number_id}. Falling back to default.`);
                                const { data: defaultVendor } = await supabase
                                    .from('vendors')
                                    .select('*')
                                    .eq('slug', 'chef-dips')
                                    .single();
                                activeVendor = defaultVendor;
                            }

                            if (!activeVendor) {
                                console.error("No active vendor found for this bot instance.");
                                return new Response('EVENT_RECEIVED', { status: 200 });
                            }

                            if (change.value.messages[0].type !== 'text') continue;
                            const msg_body = change.value.messages[0].text.body.trim();
                            const vendorToken = activeVendor.whatsapp_config?.api_token || WHATSAPP_API_TOKEN;
                            
                            console.log(`[Vendor: ${activeVendor.name}] Received message from ${from}: ${msg_body}`);

                            // 0. FETCH BOT SESSION
                            const { data: sessionData } = await supabase
                                .from('bot_sessions')
                                .select('*')
                                .eq('phone_number', from)
                                .single();
                            
                            let userState = sessionData?.state || 'IDLE';

                            // 1. Fetch live menu from database for this specific vendor
                            const { data: menuItems, error: menuErr } = await supabase
                                .from('menu_items')
                                .select('*')
                                .eq('vendor_id', activeVendor.id)
                                .order('id');

                            if (menuErr || !menuItems) {
                                await sendWhatsAppMessage(phone_number_id, from, "Sorry, our menu is currently unavailable. Please try again later.", vendorToken);
                                return new Response('EVENT_RECEIVED', { status: 200 });
                            }

                            // --- STATE: IDLE (Showing menu / picking item) ---
                            if (userState === 'IDLE') {
                                const selectionIndex = parseInt(msg_body) - 1;
                                const selectedItem = menuItems[selectionIndex];

                                if (!isNaN(selectionIndex) && selectedItem) {
                                    try {
                                        // A. Create a "pending" order
                                        const tempOrderNumber = `WA-${Date.now().toString().slice(-4)}`;
                                        const { data: locations } = await supabase.from('locations').select('id').eq('vendor_id', activeVendor.id).limit(1);
                                        const location_id = activeVendor.whatsapp_config?.default_location_id || (locations && locations[0]?.id) || null;

                                        const { data: order, error: orderErr } = await supabase
                                            .from('orders')
                                            .insert({
                                                vendor_id: activeVendor.id,
                                                status: 'pending',
                                                order_number: tempOrderNumber,
                                                customer_name: 'WhatsApp Customer',
                                                customer_phone: from,
                                                total_price: selectedItem.price,
                                                location_id: location_id
                                            })
                                            .select().single();

                                        if (orderErr) throw orderErr;

                                        await supabase.from('order_items').insert({
                                            order_id: order.id,
                                            menu_item_id: selectedItem.id,
                                            quantity: 1,
                                            price_at_time: selectedItem.price,
                                        });

                                        // B. Transition Session to PICKING_PAYMENT
                                        await supabase.from('bot_sessions').upsert({
                                            phone_number: from,
                                            vendor_id: activeVendor.id,
                                            state: 'AWAITING_PAYMENT_METHOD',
                                            last_order_id: order.id,
                                            updated_at: new Date().toISOString()
                                        });

                                        await sendWhatsAppMessage(phone_number_id, from, `🍔 Great choice: ${selectedItem.name}!\n\nHow would you like to pay?\n1. 💳 *Card / EFT (Paystack)*\n2. 💸 *1Voucher (Enter PIN)*`, vendorToken);

                                    } catch (err) {
                                        console.error(err);
                                        await sendWhatsAppMessage(phone_number_id, from, "Error processing your order.", vendorToken);
                                    }
                                } else {
                                    let menuString = `👋 Welcome to ${activeVendor.name}! What would you like to order today?\n\n`;
                                    menuItems.forEach((item: any, index: number) => {
                                        menuString += `*${index + 1}.* ${item.name} (R${item.price})\n`;
                                    });
                                    menuString += "\nReply with the *number* of your choice.";
                                    await sendWhatsAppMessage(phone_number_id, from, menuString, vendorToken);
                                }
                            } 
                            
                            // --- STATE: AWAITING PAYMENT METHOD ---
                            else if (userState === 'AWAITING_PAYMENT_METHOD') {
                                if (msg_body === '1') {
                                    // Paystack Path
                                    const { data: order } = await supabase.from('orders').select('*').eq('id', sessionData.last_order_id).single();
                                    
                                    const vendorSecret = activeVendor.paystack_secret_key || PAYSTACK_SECRET_KEY;

                                    if (!vendorSecret) {
                                        await sendWhatsAppMessage(phone_number_id, from, "Payment system is currently unavailable. Please contact the shop directly.", vendorToken);
                                        return new Response('EVENT_RECEIVED', { status: 200 });
                                    }

                                    const payResponse = await fetch('https://api.paystack.co/transaction/initialize', {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${vendorSecret}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            email: `${from}@whatsapp.kotaguard.com`,
                                            amount: Math.round(order.total_price * 100),
                                            currency: 'ZAR',
                                            metadata: { order_id: order.id, vendor_id: activeVendor.id, source: 'whatsapp_bot' }
                                        })
                                    });

                                    const payData = await payResponse.json();
                                    if (payData.status) {
                                        await sendWhatsAppMessage(phone_number_id, from, `🍔 Pay securely here to confirm:\n🔗 ${payData.data.authorization_url}`, vendorToken);
                                        await supabase.from('bot_sessions').upsert({ phone_number: from, state: 'IDLE' });
                                    }
                                } else if (msg_body === '2') {
                                    // 1Voucher Path
                                    await sendWhatsAppMessage(phone_number_id, from, "💸 Excellent! Please enter your *16-digit 1Voucher PIN* below:", vendorToken);
                                    await supabase.from('bot_sessions').upsert({ phone_number: from, state: 'AWAITING_VOUCHER_PIN' });
                                } else {
                                    await sendWhatsAppMessage(phone_number_id, from, "Please reply with *1* for Card or *2* for 1Voucher.", vendorToken);
                                }
                            }

                            // --- STATE: AWAITING VOUCHER PIN ---
                            else if (userState === 'AWAITING_VOUCHER_PIN') {
                                const pin = msg_body.replace(/\D/g, '');
                                if (pin.length === 16) {
                                    await sendWhatsAppMessage(phone_number_id, from, "⌛ Validating your voucher... Please wait.", vendorToken);
                                    
                                    // MOCK REDEMPTION (Structure for Netcash API)
                                    // In production, we'd call Netcash PayNow Request with PIN
                                    const isMockSuccess = true; 

                                    if (isMockSuccess) {
                                        // 1. Mark Order Paid
                                        const { data: order } = await supabase.from('orders').select('*').eq('id', sessionData.last_order_id).single();
                                        await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id);

                                        // 2. Confirm to User
                                        await sendWhatsAppMessage(phone_number_id, from, `✅ SUCCESS! Your voucher has been redeemed.\n\nYour collection number is: *${order.order_number}*\n\nChef Dips is now preparing your Kota! 🍔🔥`, vendorToken);
                                        
                                        // 3. Reset Session
                                        await supabase.from('bot_sessions').upsert({ phone_number: from, state: 'IDLE' });
                                    } else {
                                        await sendWhatsAppMessage(phone_number_id, from, "❌ Sorry, that voucher PIN seems to be invalid or already used. Please try another or type 'menu' to start over.", vendorToken);
                                    }
                                } else {
                                    await sendWhatsAppMessage(phone_number_id, from, "⚠️ That doesn't look like a 16-digit PIN. Please re-enter your 16-digit 1Voucher PIN:", vendorToken);
                                }
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
async function sendWhatsAppMessage(phone_number_id: string, to: string, message: string, apiToken?: string) {
    const token = apiToken || WHATSAPP_API_TOKEN;
    if (!token) {
        console.error("Missing WhatsApp API Token.");
        return;
    }

    const url = `https://graph.facebook.com/v17.0/${phone_number_id}/messages`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
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
