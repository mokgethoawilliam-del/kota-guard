import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase admin client with SERVICE_ROLE key to bypass RLS policies
// since this is a backend operation triggered by Paystack.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-paystack-signature');

        // 1. Verify Paystack Signature to stop scams (ensure the request is truly from Paystack)
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const hash = crypto
            .createHmac('sha512', secret)
            .update(rawBody)
            .digest('hex');

        if (hash !== signature) {
            return new Response('Invalid signature', { status: 401 });
        }

        const event = JSON.parse(rawBody);

        // 2. Verify it is a successful charge
        if (event.event === 'charge.success') {
            const { metadata } = event.data;

            // Assume the frontend passes the order ID and cart details in the Paystack metadata
            // e.g. metadata: { order_id: '123-uuid', cart: [{ id: 'menu_item_uuid', quantity: 2 }] }
            const orderId = metadata?.order_id;
            const cart = metadata?.cart || [];

            if (!orderId) {
                return new Response('Order ID missing in metadata', { status: 400 });
            }

            // 3. Generate unique 4-digit order number (e.g. 5502)
            // Pad with zero if necessary to ensure it's always 4 digits
            const orderNumber = Math.floor(1000 + Math.random() * 9000).toString();

            // 4. Update the order status to 'paid' and set the order_number
            const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'paid', order_number: orderNumber })
                .eq('id', orderId)
                .eq('status', 'pending'); // Ensure we don't process already paid orders

            if (orderError) throw orderError;

            // 5. Inventory Logic
            if (cart.length > 0) {
                // Extract array of menu_item IDs from the cart
                const itemIds = cart.map(item => item.id);

                // Fetch the corresponding recipe_json for the ordered items
                const { data: menuItems, error: menuError } = await supabase
                    .from('menu_items')
                    .select('id, recipe_json')
                    .in('id', itemIds);

                if (menuError) throw menuError;

                // Calculate total amounts to deduct for each raw ingredient
                const inventoryDeductions = {};

                for (const cartItem of cart) {
                    const menuItem = menuItems.find(m => m.id === cartItem.id);
                    if (menuItem && menuItem.recipe_json) {
                        const recipe = menuItem.recipe_json;
                        // Loop through each ingredient in the recipe
                        for (const [ingredientName, amountPerItem] of Object.entries(recipe)) {
                            // Multiply recipe requirement by the quantity ordered
                            const totalAmountUsed = amountPerItem * (cartItem.quantity || 1);

                            inventoryDeductions[ingredientName] =
                                (inventoryDeductions[ingredientName] || 0) + totalAmountUsed;
                        }
                    }
                }

                // Apply deductions to the inventory table
                for (const [ingredientName, amountToDeduct] of Object.entries(inventoryDeductions)) {
                    // Fetch current quantity
                    // Note: In high currency environments, it's safer to use an RPC (Remote Procedure Call) 
                    // to decrement values to avoid race conditions, but this standard approach works for basic setups.
                    const { data: invData, error: invGetError } = await supabase
                        .from('inventory')
                        .select('quantity')
                        .eq('item_name', ingredientName)
                        .single();

                    if (!invGetError && invData) {
                        const newQuantity = invData.quantity - amountToDeduct;

                        await supabase
                            .from('inventory')
                            .update({ quantity: newQuantity })
                            .eq('item_name', ingredientName);
                    }
                }
            }
        }

        return new Response('Webhook processed successfully', { status: 200 });

    } catch (error) {
        console.error('Webhook processing error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
