const fs = require('fs');

const blueprintFile = 'components/AdminDashboard_modern.jsx';
const targetFile = 'components/AdminDashboard.jsx';

console.log('--- Sledgehammer RECONSTRUCTION Initiated ---');

// 1. Read Blueprint
let content = fs.readFileSync(blueprintFile, 'utf8');

// 2. STRIP ALL NON-ASCII CHARACTERS (The Nuclear Option)
// This removes ALL emojis and ghost characters, leaving only clean code.
content = content.replace(/[^\x00-\x7F]/g, '');

// 3. Global Database Re-wiring (No kg_)
content = content.split("'kg_orders'").join("'orders'");
content = content.split("'kg_support_chats'").join("'support_chats'");
content = content.split("'kg_profiles'").join("'profiles'");
content = content.split("'kg_vendors'").join("'vendors'");

// 4. Inject SVG Header Icons logic
// We add more SVG icons to the Icons object
const iconInsertionPoint = 'CreditCard: () => (';
const newIcons = `Bell: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
        ),
        Chef: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 13.8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9.8"></path>
                <path d="M19 13c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z"></path>
                <path d="M5 13c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z"></path>
                <path d="M2 16h20"></path>
            </svg>
        ),
        Check: () => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        ),
        `;
content = content.replace(iconInsertionPoint, newIcons + iconInsertionPoint);

// 5. Replace Corrupted Header Text with Icons + Clean Text
content = content.replace(/<h2>.*NEW ORDERS.*<\/h2>/g, '<h2><Icons.Bell style={{marginRight:"8px", verticalAlign:"middle", width:"24px", display:"inline-block"}} /> NEW ORDERS ({newOrders.length})</h2>');
content = content.replace(/<h2>.*PREPARING.*<\/h2>/g, '<h2><Icons.Chef style={{marginRight:"8px", verticalAlign:"middle", width:"24px", display:"inline-block"}} /> PREPARING ({prepOrders.length})</h2>');
content = content.replace(/<h2>.*READY FOR COLLECTION.*<\/h2>/g, '<h2><Icons.Check style={{marginRight:"8px", verticalAlign:"middle", width:"24px", display:"inline-block"}} /> READY FOR COLLECTION ({readyOrders.length})</h2>');

// 6. Inject Inventory Sync (Recipe JSON)
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

// 7. Inject Collection Code Security
const completionSearch = "if (newStatus === 'completed') {";
const completionLogic = `if (newStatus === 'completed') {
                if (order && order.order_number) {
                    const expectedCode = order.order_number.split('/').pop(); 
                    const userInput = window.prompt(\`SECURITY CHECK: Enter the Customer\\'s 3-digit Collection Code (e.g., \${expectedCode}) to finalize delivery:\`);
                    if (userInput !== expectedCode) {
                        alert("INVALID CODE: Order cannot be marked as delivered without the correct customer secret.");
                        return;
                    }
                }`;
content = content.replace(completionSearch, completionLogic);

// 8. Fix infinite loading bug
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

// 9. Add Cache Breaking Signature
const buildId = 'BUILD_v_' + Date.now();
content = '/* ' + buildId + ' - SLEDGEHAMMER PURIFIED */\n' + content;

// 10. Write File
fs.writeFileSync(targetFile, content, 'utf8');

console.log('--- Sledgehammer Reconstruction Successful ---');
console.log('Build ID: ' + buildId);
