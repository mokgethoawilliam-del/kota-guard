const fs = require('fs');

const blueprintFile = 'components/AdminDashboard_modern.jsx';
const targetFile = 'components/Dashboard_Final.jsx';

console.log('--- Sledgehammer RECONSTRUCTION v2 Initiated ---');

// 1. Read Blueprint and Force Remove BOM
let content = fs.readFileSync(blueprintFile, 'utf8');
content = content.replace(/^\uFEFF/, ''); 

// 2. STRIP ALL NON-ASCII CHARACTERS (Nuclear Option)
content = content.replace(/[^\x00-\x7F]/g, '');

// 3. Global Database Re-wiring (No )
const tables = ['orders', 'support_chats', 'profiles', 'vendors', 'ingredients', 'menu_items', 'expenses', 'locations', 'testimonials'];
tables.forEach(t => { content = content.split("'" + t + "'").join("'" + t + "'"); });

// 4. Inject SVG Header Icons logic
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

// 6. SMART REPLACEMENT: loadProfileAndData function body
const oldFunctionStart = 'const loadProfileAndData = async () => {';
const oldFunctionEnd = 'loadProfileAndData().finally(() => setLoading(false));';
const startIdx = content.indexOf(oldFunctionStart);
const endIdx = content.indexOf(oldFunctionEnd, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newFunctionBody = `const loadProfileAndData = async () => {
            if (!session?.user?.id) return;
            const { data: profileData, error: pErr } = await supabase.from('profiles').select('vendor_id, full_name').eq('id', session.user.id).single();

            if (pErr || !profileData) {
                console.warn(\"Profile table entry not found, checking fallback...\");
                const metadata = session.user.user_metadata;
                if (metadata?.vendor_id) {
                    setProfile({ vendor_id: metadata.vendor_id, full_name: metadata.full_name || 'Owner' });
                    setCurrentVendorId(metadata.vendor_id);
                }
                setLoading(false);
                return;
            }
            setProfile(profileData);
            setCurrentVendorId(profileData.vendor_id);
            setLoading(false);
        };

        `;
    content = content.substring(0, startIdx) + newFunctionBody + content.substring(endIdx);
}

// 7. Inject Collection Code Security
const completionSearch = "if (newStatus === 'completed') {";
const completionLogic = `if (newStatus === 'completed') {
                if (order && order.order_number) {
                    const expectedCode = order.order_number.split('/').pop(); 
                    const userInput = window.prompt(\`SECURITY CHECK: Enter the Customers 3-digit Collection Code (e.g., \${expectedCode}) to finalize delivery:\`);
                    if (userInput !== expectedCode) {
                        alert(\"INVALID CODE: Order cannot be marked as delivered without the correct customer secret.\");
                        return;
                    }
                }`;
content = content.replace(completionSearch, completionLogic);

// 8. Final Cache Break Build ID
const buildId = 'BUILD_v_' + Date.now();
content = '/* ' + buildId + ' - SLEDGEHAMMER PURIFIED v2 */\n' + content.replace('AdminDashboard', 'Dashboard_Final');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('--- Sledgehammer Reconstruction v2 Successful ---');
console.log('Build ID: ' + buildId);
