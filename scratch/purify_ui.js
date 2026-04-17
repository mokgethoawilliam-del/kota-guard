const fs = require('fs');

const targetFile = 'components/AdminDashboard.jsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = {
    // Icons
    '≡ƒôÑ': '🔔',
    '≡ƒì│': '🍳',
    '≡ƒìö': '🍔',
    '≡ƒôñÅ': '✅',
    '≡ƒôñ': '✅',
    '≡ƒ¢ì∩╕Å': '🛍️',
    '≡ƒÜÜ': '🚚',
    '≡ƒôä': '📄',
    '≡ƒöä': '🔄',
    '≡ƒÅ¬': '🏪',
    '≡ƒÜ¿': '🚨',
    '≡ƒÆ¼': '💬',
    '≡ƒùä∩╕Å': '🗄️',
    '≡ƒÆ░': '💰',
    '≡ƒÆ╕': '💸',
    '≡ƒöì': '🔍',
    '≡ƒöÆ': '🔒',
    '≡ƒôè': '📊',
    '≡ƒƒó': '🟠',
    '≡ƒùô∩╕Å': '🗓️',
    '≡ƒÅá': '🏠',
    '≡ƒò╡∩╕Å': '🕵️',
    '≡ƒæï': '👋',
    '≡ƒôï': '📋',
    '≡ƒöÄ': '🔎',
    '≡ƒô£': '📜',
    '≡ƒæñ': '👨‍🍳',
    '≡ƒîÉ': '🌐',
    '≡ƒæì': '👍',
    '≡ƒÄë': '🎊',
    '≡ƒöÉ': '🔑',
    '≡ƒö│': '⚙️',
    '≡ƒæÑ': '👤',
    '≡ƒöÑ': '🔥',
    '≡ƒÄ¿': '🎨',
    '≡ƒÅ¢∩╕Å': '🏛️',
    '≡ƒôì': '📍',
    
    // Arrows and Symbols
    'ΓåÉ': '←',
    'ΓåÆ': '→',
    'ΓÇó': '•',
    'Γ£ö': '✅',
    'Γ£û': '❌',
    'ΓÜá': '⚠️',
    'Γäó': '™',
    'Γöü': '─',
    'ΓöÇ': '─',
    'Γöé': '│',
    'Γöî': '┌',
    'ΓöÉ': '┐',
    'Γö└': '└',
    'Γöÿ': '┘'
};

Object.keys(replacements).forEach(key => {
    content = content.split(key).join(replacements[key]);
});

// Final safety pass for any stray byte sequences
content = content.replace(/≡ƒ[^\s<"']*/g, '');
content = content.replace(/Γ[^\s<"']*/g, '');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('AdminDashboard.jsx: Global purification complete. UI is now titanium-grade.');
