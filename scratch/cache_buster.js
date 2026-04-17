const fs = require('fs');
const path = require('path');

const moves = [
    ['components/AdminDashboard.jsx', 'components/Dashboard_Final.jsx'],
    ['components/RegisterShop.jsx', 'components/Registration_Final.jsx'],
    ['components/MenuList.jsx', 'components/Menu_Final.jsx']
];

console.log('--- cache_buster.js Initiated ---');

moves.forEach(([oldPath, newPath]) => {
    if (!fs.existsSync(oldPath)) {
        console.log('Skipping: ' + oldPath + ' (Already moved or does not exist)');
        return;
    }
    let c = fs.readFileSync(oldPath, 'utf8');
    
    // Rename component name and class/function names inside the file
    const oldName = path.basename(oldPath, '.jsx');
    const newName = path.basename(newPath, '.jsx');
    
    // Safety check for emojis again
    c = c.replace(/[^\x00-\x7F]/g, '');
    
    // Rename occurrences
    c = c.split(oldName).join(newName);
    
    fs.writeFileSync(newPath, c, 'utf8');
    fs.unlinkSync(oldPath);
    console.log('Renamed: ' + oldPath + ' -> ' + newPath);
});

// 2. Update App.jsx imports and components
const appPath = 'src/App.jsx';
if (fs.existsSync(appPath)) {
    let app = fs.readFileSync(appPath, 'utf8');
    
    // Update Imports
    app = app.replace("import AdminDashboard from '../components/AdminDashboard'", "import AdminDashboard from '../components/Dashboard_Final'");
    app = app.replace("import RegisterShop from '../components/RegisterShop'", "import RegisterShop from '../components/Registration_Final'");
    
    // Update JSX tags
    app = app.replace('<AdminDashboard ', '<Dashboard_Final ');
    app = app.replace('</AdminDashboard>', '</Dashboard_Final>');
    app = app.replace('<RegisterShop ', '<Registration_Final ');
    app = app.replace('</RegisterShop>', '</Registration_Final>');

    fs.writeFileSync(appPath, app, 'utf8');
    console.log('App.jsx updated with Dashboard_Final and Registration_Final.');
} else {
    console.error('CRITICAL ERROR: App.jsx not found!');
}

console.log('--- cache_buster.js Successful ---');
