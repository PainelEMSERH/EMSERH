// Ensures Tailwind v3 directives exist in app/globals.css exactly once.
const fs = require('fs');
const path = require('path');

const globals = path.join(process.cwd(), 'app', 'globals.css');
if (!fs.existsSync(globals)) {
  console.log('[ensure-tailwind-directives] globals.css not found, skipping');
  process.exit(0);
}

let css = fs.readFileSync(globals, 'utf8');

// Remove any @import of Tailwind v4 style.
css = css.replace(/@import\s+["']tailwindcss["'];?\s*/g, '');
css = css.replace(/@config\s+["'][^"']+["'];?\s*/g, '');

// Ensure @tailwind base/components/utilities at very top in v3 order
const directives = ['@tailwind base;', '@tailwind components;', '@tailwind utilities;'];
for (const d of directives) {
  if (!css.includes(d)) {
    css = `${d}\n` + css;
  }
}

// Remove duplicate @tailwind lines (keep first occurrence)
const seen = new Set();
css = css.split('\n').filter(line => {
  if (line.trim().startsWith('@tailwind')) {
    if (seen.has(line.trim())) return false;
    seen.add(line.trim());
    return true;
  }
  return true;
}).join('\n');

fs.writeFileSync(globals, css, 'utf8');
console.log('[ensure-tailwind-directives] normalized app/globals.css');
