const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

// I will just add an extra } at the end.
fs.writeFileSync('src/pages/Products.tsx', code + '\n}\n');
