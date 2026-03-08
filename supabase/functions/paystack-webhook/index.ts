import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Verify Paystack Signature
        const signature = req.headers.get('x-paystack-signature')
        if (!signature) {
            return new Response('Missing signature', { status: 401, headers: corsHeaders })
        }

        const bodyText = await req.text()
        const secret = Deno.env.get('PAYSTACK_SECRET_KEY')

        if (!secret) {
            console.error("PAYSTACK_SECRET_KEY is not set.")
            return new Response('Internal Server Error', { status: 500, headers: corsHeaders })
        }

        // Hash the body with the secret key
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-512" },
            false,
            ["sign"]
        )

        const signatureBuffer = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(bodyText)
        )

        // Convert ArrayBuffer to Hex String
        const hashArray = Array.from(new Uint8Array(signatureBuffer))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        if (hashHex !== signature) {
            console.error("Invalid signature. Expected:", signature, "Got:", hashHex)
            return new Response('Invalid signature', { status: 401, headers: corsHeaders })
        }

        const payload = JSON.parse(bodyText)

        // 2. Process the event if it's a successful charge
        if (payload.event === 'charge.success') {
            // Initialize Supabase client
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            // Use service_role key to bypass RLS policies for webhooks
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            const supabase = createClient(supabaseUrl, supabaseKey)

            const metadata = payload.data.metadata || {}
            const orderId = metadata.order_id
            const cart = metadata.cart || [] // Array of { id: menu_item_id, quantity: number }

            if (!orderId) {
                console.error("Order ID missing in metadata.")
                return new Response('Order ID missing', { status: 400, headers: corsHeaders })
            }

            // 3. Generate a 4-digit order number (1000 - 9999)
            const orderNumber = Math.floor(1000 + Math.random() * 9000).toString()

            // 4. Update the order status to 'paid'
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    status: 'paid',
                    order_number: orderNumber
                })
                .eq('id', orderId)
                .eq('status', 'pending') // Only update if currently pending

            if (updateError) {
                console.error("Error updating order:", updateError)
                throw updateError
            }

            console.log(`Order ${orderId} updated to paid. Order number: ${orderNumber}`)

            // 5. Inventory Deduction Logic
            if (cart.length > 0) {
                const itemIds = cart.map((item: any) => item.id)

                // Fetch recipes for the ordered items
                const { data: menuItems, error: menuError } = await supabase
                    .from('menu_items')
                    .select('id, recipe_json')
                    .in('id', itemIds)

                if (menuError) {
                    console.error("Error fetching menu items:", menuError)
                    throw menuError
                }

                const inventoryDeductions: Record<string, number> = {}

                // Calculate total amount of each ingredient needed
                for (const cartItem of cart) {
                    const menuItem = menuItems?.find(m => m.id === cartItem.id)
                    if (menuItem && menuItem.recipe_json) {
                        const recipe = menuItem.recipe_json as Record<string, number>
                        const quantity = cartItem.quantity || 1

                        for (const [ingredient, amountPerItem] of Object.entries(recipe)) {
                            const totalAmountUsed = amountPerItem * quantity
                            inventoryDeductions[ingredient] = (inventoryDeductions[ingredient] || 0) + totalAmountUsed
                        }
                    }
                }

                // Apply deductions one by one
                // In a production app with high concurrency, consider using a Supabase RPC
                // function to decrement the value atomically: `quantity = quantity - x`
                for (const [ingredient, amountToDeduct] of Object.entries(inventoryDeductions)) {
                    const { data: currentInv, error: fetchInvError } = await supabase
                        .from('inventory')
                        .select('quantity')
                        .eq('item_name', ingredient)
                        .single()

                    if (fetchInvError || !currentInv) {
                        console.error(`Error fetching inventory for ${ingredient}:`, fetchInvError)
                        continue // Skip to next ingredient on error
                    }

                    const newQuantity = currentInv.quantity - amountToDeduct

                    const { error: updateInvError } = await supabase
                        .from('inventory')
                        .update({ quantity: newQuantity })
                        .eq('item_name', ingredient)

                    if (updateInvError) {
                        console.error(`Error updating inventory for ${ingredient}:`, updateInvError)
                    } else {
                        console.log(`Deducted ${amountToDeduct} from ${ingredient}. New quantity: ${newQuantity}`)
                    }
                }
            }
        }

        return new Response(JSON.stringify({ message: 'Webhook processed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('Webhook error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
