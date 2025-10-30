// scripts/ensure-tailwind-directives.cjs
// Guarantee Tailwind v3 directives at the top of app/globals.css ONLY.
const fs = require('fs'); const path = require('path');
const filePath = path.join(process.cwd(), 'app', 'globals.css');
if (!fs.existsSync(filePath)) { console.error('[ensure-tailwind-directives] app/globals.css not found'); process.exit(0); }
let content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');

// Remove any Tailwind v4 imports/config
content = content.replace(/^\s*@import\s+["']tailwindcss(?:\/[a-z-]+)?["'];?\s*$/gmi, '');
content = content.replace(/^\s*@config\s+["'][^"']+["'];?\s*$/gmi, '');

// Ensure v3 directives present exactly once at the very top
content = content.replace(/\s*^@tailwind\s+base;\s*/gmi, '');
content = content.replace(/\s*^@tailwind\s+components;\s*/gmi, '');
content = content.replace(/\s*^@tailwind\s+utilities;\s*/gmi, '');
content = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' + content;

fs.writeFileSync(filePath, content, 'utf8');
console.log('[ensure-tailwind-directives] normalized app/globals.css');
