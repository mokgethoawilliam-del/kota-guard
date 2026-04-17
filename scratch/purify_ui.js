const fs = require('fs');

const targetFile = 'components/AdminDashboard.jsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = {
    // Icons
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    
    // Arrows and Symbols
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': '',
    '': ''
};

Object.keys(replacements).forEach(key => {
    content = content.split(key).join(replacements[key]);
});

// Final safety pass for any stray byte sequences
content = content.replace(/[^\s<"']*/g, '');
content = content.replace(/[^\s<"']*/g, '');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('AdminDashboard.jsx: Global purification complete. UI is now titanium-grade.');
