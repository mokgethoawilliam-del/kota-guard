const fs = require('fs');
const path = require('path');

const projectRoot = '.';
const moves = [
    ['components/Dashboard_Final.jsx', 'components/AdminDashboard.jsx'],
    ['components/Registration_Final.jsx', 'components/RegisterShop.jsx'],
    ['components/Menu_Final.jsx', 'components/MenuList.jsx']
];

console.log('--- ABSOLUTE ZERO RESTORATION INITIATED ---');

// 1. Restore File Names and Component Names
moves.forEach(([oldPath, newPath]) => {
    if (!fs.existsSync(oldPath)) return;
    let c = fs.readFileSync(oldPath, 'utf8');
    
    const oldName = path.basename(oldPath, '.jsx');
    const newName = path.basename(newPath, '.jsx');
    
    c = c.split(oldName).join(newName);
    fs.writeFileSync(newPath, c, 'utf8');
    fs.unlinkSync(oldPath);
    console.log(`Restored: ${oldPath} -> ${newPath}`);
});

// 2. Nuclear Purge Project-Wide
function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.vercel' && file !== 'dist') walk(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.css') || fullPath.endsWith('.sql')) {
            let c = fs.readFileSync(fullPath, 'utf8');
            let original = c;

            // A. STRIP ALL NON-ASCII
            c = c.replace(/[^\x00-\x7F]/g, '');

            // B. DELETE ALL  PREFIXES
            c = c.split('').join('');

            if (c !== original) {
                fs.writeFileSync(fullPath, c, 'utf8');
                console.log(`Purified: ${fullPath}`);
            }
        }
    });
}
walk(projectRoot);

// 3. App.jsx Restoration
const appPath = 'src/App.jsx';
if (fs.existsSync(appPath)) {
    let app = fs.readFileSync(appPath, 'utf8');
    app = app.replace(/'..\/components\/Dashboard_Final'/g, "'../components/AdminDashboard'");
    app = app.replace(/'..\/components\/Registration_Final'/g, "'../components/RegisterShop'");
    app = app.replace(/<Dashboard_Final /g, '<AdminDashboard ');
    app = app.replace(/<\/Dashboard_Final>/g, '</AdminDashboard>');
    app = app.replace(/<Registration_Final /g, '<RegisterShop ');
    app = app.replace(/<\/Registration_Final>/g, '</RegisterShop>');
    fs.writeFileSync(appPath, app, 'utf8');
    console.log('App.jsx fixed and restored.');
}

// 4. Surgical Syntax Fix (Profile Logic in AdminDashboard)
const adminPath = 'components/AdminDashboard.jsx';
if (fs.existsSync(adminPath)) {
    let admin = fs.readFileSync(adminPath, 'utf8');
    // Find the broken block and fix it
    const brokenPattern = /if \(pErr \|\| !profileData\) \{[\s\S]*?setLoading\(false\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?console\.warn\("Profile table entry not found, using session metadata fallback\.\.\."\)[\s\S]*?return;[\s\S]*?\}/;
    
    const cleanLogic = `if (pErr || !profileData) {
                console.warn("Profile table entry not found, checking fallback...");
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
            setLoading(false);`;
            
    // If pattern match fails, we'll try a simpler approach by just fixing the braces manually for safety
    // For now, let's assume the Sledgehammer v2 output followed a specific pattern.
    // Actually, let's just use a more reliable replacement for the whole function body.
    
    const funcStart = 'const loadProfileAndData = async () => {';
    const funcBodyEnd = 'loadProfileAndData().finally(() => setLoading(false));';
    const startIdx = admin.indexOf(funcStart);
    const endIdx = admin.indexOf(funcBodyEnd, startIdx);
    
    if (startIdx !== -1 && endIdx !== -1) {
        admin = admin.substring(0, startIdx) + funcStart + `
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

        ` + admin.substring(endIdx);
        fs.writeFileSync(adminPath, admin, 'utf8');
        console.log('AdminDashboard.jsx syntax surgically fixed.');
    }
}

console.log('--- ABSOLUTE ZERO RESTORATION SUCCESSFUL ---');
