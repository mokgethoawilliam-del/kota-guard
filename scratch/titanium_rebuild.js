const fs = require('fs');

const blueprintFile = 'components/AdminDashboard_modern.jsx';
const targetFile = 'components/AdminDashboard.jsx';

console.log('--- Titanium Clean-Room Rebuild Initiated ---');

// 1. Read Blueprint and Force Remove BOM
let content = fs.readFileSync(blueprintFile, 'utf8');
content = content.replace(/^\uFEFF/, ''); 

// 2. Global Database Re-wiring (Stripping kg_)
content = content.split("'kg_orders'").join("'orders'");
content = content.split("'kg_support_chats'").join("'support_chats'");
content = content.split("'kg_profiles'").join("'profiles'");
content = content.split("'kg_vendors'").join("'vendors'");

// 3. Inject Inventory Sync (Recipe JSON)
const inventorySearch = "if ((newStatus === 'preparing' || newStatus === 'ready') && order.status === 'paid') {";
const inventoryLogic = `if ((newStatus === 'preparing' || newStatus === 'ready') && order.status === 'paid') {
                console.log(\`Inventory: Deducting for order \${orderId} moving to \${newStatus}\`);
                if (order && order.order_items) {
                    const inventoryDeductions = {};
                    order.order_items.forEach(item => {
                        const recipe = item.menu_items?.recipe_json || {};
                        const qty = Number(item.quantity || 1);
                        Object.keys(recipe).forEach(ingredientName => {
                            const amountPerItem = Number(recipe[ingredientName]);
                            inventoryDeductions[ingredientName] = (inventoryDeductions[ingredientName] || 0) + (amountPerItem * qty);
                        });
                    });

                    for (const ingredientName of Object.keys(inventoryDeductions)) {
                        const amountToDeduct = inventoryDeductions[ingredientName];
                        supabase.from('ingredients')
                            .select('id, current_stock')
                            .eq('name', ingredientName)
                            .eq('vendor_id', currentVendorId)
                            .maybeSingle()
                            .then(({ data: invData, error: fetchErr }) => {
                                if (!fetchErr && invData && invData.current_stock !== null) {
                                    const newStock = Math.max(0, Number(invData.current_stock) - amountToDeduct);
                                    supabase.from('ingredients').update({ current_stock: newStock }).eq('id', invData.id).then();
                                }
                            });
                    }
                }`;
content = content.replace(inventorySearch, inventoryLogic);

// 4. Inject Collection Code Security
const completionSearch = "if (newStatus === 'completed') {";
const completionLogic = `if (newStatus === 'completed') {
                if (order && order.order_number) {
                    const expectedCode = order.order_number.split('/').pop(); 
                    const userInput = window.prompt(\`🔒 SECURITY CHECK: Enter the Customer's 3-digit Collection Code (e.g., \${expectedCode}) to finalize delivery:\`);
                    if (userInput !== expectedCode) {
                        alert("❌ INVALID CODE: Order cannot be marked as delivered without the correct customer secret.");
                        return;
                    }
                }`;
content = content.replace(completionSearch, completionLogic);

// 5. Fix infinite loading bug
const loadingSearch = "if (pErr || !profileData) {";
const loadingFix = `if (pErr || !profileData) {
                console.warn("Profile table entry not found, checking session metadata fallback...");
                const metadata = session.user.user_metadata;
                if (metadata?.vendor_id) {
                    const fallbackProfile = {
                        vendor_id: metadata.vendor_id,
                        full_name: metadata.full_name || 'Shop Owner'
                    };
                    setProfile(fallbackProfile);
                    setCurrentVendorId(metadata.vendor_id);
                } else {
                    console.error("Critical: No vendor_id found in profile OR metadata.", pErr);
                }
                setLoading(false);
                return;
            }`;
content = content.replace(loadingSearch, loadingFix);

// 6. Final "Purification" - Strip all non-ASCII unless explicitly allowed (Emojis)
// Allowed Emojis: 🧭 👤 🔥 💬 🗄️ 📊 📦 🚚 🎨 📍 🗓️ 💰 🔐 🔒 🔓 🍔 📄 🔄 🏪 🚨 👋 🎊 🔑 ⚙️ 🛒 💳 💸 ✅ ❌ 🏠
const allowedEmojis = '🧭👤🔥💬🗄️📊📦🚚🎨📍🗓️💰🔐🔒🔓🍔📄🔄🏪🚨👋🎊🔑⚙️🛒💳💸✅❌🏠•⭐←';
const purificationRegex = new RegExp(`[^\x00-\x7F${allowedEmojis}]`, 'g');

// Before stripping, replace KNOWN corrupted pairs with their clean emoji equivalents
const cleanup = {
    '≡ƒôÑ': '🔔', '≡ƒì│': '👨‍🍳', '≡ƒ¢ì': '🛍️', '≡ƒô▓': '⚙️', '≡ƒæÑ': '👤', '≡ƒöÑ': '🔥',
    'ΓåÉ': '←', 'ΓÇó': '•', 'Æ╛': '💾', '∩╕Å': '', 'Γäó': '™'
};
Object.keys(cleanup).forEach(k => { content = content.split(k).join(cleanup[k]); });

// Now strip any remaining multi-byte corruption
content = content.replace(purificationRegex, '');

// Ensure no double-spaces or weird residues
content = content.replace(/ +(?= )/g,'');

fs.writeFileSync(targetFile, content, 'utf8');

console.log('--- Titanium Clean-Room Rebuild Successful ---');
console.log('File written: components/AdminDashboard.jsx');
