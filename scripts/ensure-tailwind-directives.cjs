// scripts/ensure-tailwind-directives.cjs
// Ensures app/globals.css starts with Tailwind v3 directives
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'globals.css');
if (!fs.existsSync(filePath)) {
  console.error('[ensure-tailwind-directives] app/globals.css not found');
  process.exit(0); // don't fail build
}

const content = fs.readFileSync(filePath, 'utf8');
const hasBase = /@tailwind\s+base;/.test(content);
const hasComp = /@tailwind\s+components;/.test(content);
const hasUtil = /@tailwind\s+utilities;/.test(content);

if (hasBase && hasComp && hasUtil) {
  console.log('[ensure-tailwind-directives] directives already present');
  process.exit(0);
}

const lines = [
  '@tailwind base;',
  '@tailwind components;',
  '@tailwind utilities;',
  ''
];

const updated = lines.join('\n') + content.replace(/^\uFEFF/, ''); // remove BOM if present
fs.writeFileSync(filePath, updated, 'utf8');
console.log('[ensure-tailwind-directives] directives prepended to app/globals.css');
