// scripts/ensure-tailwind-directives.cjs
const fs = require('fs'); const path = require('path');
const filePath = path.join(process.cwd(), 'app', 'globals.css');
if (!fs.existsSync(filePath)) { console.error('[ensure-tailwind-directives] app/globals.css not found'); process.exit(0); }
let content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
const hasBase = /@tailwind\s+base;/.test(content);
const hasComp = /@tailwind\s+components;/.test(content);
const hasUtil = /@tailwind\s+utilities;/.test(content);
if (!(hasBase && hasComp && hasUtil)) {
  content = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' + content;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[ensure-tailwind-directives] prepended v3 directives');
} else {
  console.log('[ensure-tailwind-directives] directives already present');
}
