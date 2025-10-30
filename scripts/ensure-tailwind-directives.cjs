// scripts/ensure-tailwind-directives.cjs
// Make app/globals.css compatible with Tailwind v3:
// 1) Remove Tailwind v4 CSS imports like: @import "tailwindcss"; @import "tailwindcss/base";
// 2) Remove optional @config lines (v4-only) to avoid noise.
// 3) Ensure file starts with @tailwind base/components/utilities.
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'globals.css');
if (!fs.existsSync(filePath)) {
  console.error('[ensure-tailwind-directives] app/globals.css not found');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

// Strip BOM
content = content.replace(/^\uFEFF/, '');

// Remove Tailwind v4 imports (any variant)
content = content.replace(/^\s*@import\s+["']tailwindcss(?:\/[a-z-]+)?["'];?\s*$/gmi, '');

// Remove optional @config lines (v4-only)
content = content.replace(/^\s*@config\s+["'][^"']+["'];?\s*$/gmi, '');

// Check if v3 directives exist
const hasBase = /@tailwind\s+base;/.test(content);
const hasComp = /@tailwind\s+components;/.test(content);
const hasUtil = /@tailwind\s+utilities;/.test(content);

// Prepend if missing
if (!(hasBase && hasComp && hasUtil)) {
  const prefix = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n';
  content = prefix + content;
  console.log('[ensure-tailwind-directives] prepended v3 directives');
} else {
  console.log('[ensure-tailwind-directives] v3 directives already present');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('[ensure-tailwind-directives] globals.css normalized for Tailwind v3');
