// scripts/fix-tailwind-classes.cjs
// Fix CSS across the repo for Tailwind v3 compatibility
const fs = require('fs'); const path = require('path');

function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walk(p));
    else if (ent.isFile() && p.endsWith('.css')) out.push(p);
  }
  return out;
}

const roots = ['app','components','src'];
let changed = 0;

for (const root of roots) {
  for (const file of walk(root)) {
    let txt = fs.readFileSync(file, 'utf8');
    const orig = txt;

    // Remove Tailwind v4 imports and @config
    txt = txt.replace(/^\s*@import\s+["']tailwindcss(?:\/[a-z-]+)?["'];?\s*$/gmi, '');
    txt = txt.replace(/^\s*@config\s+["'][^"']+["'];?\s*$/gmi, '');

    // Replace unsupported classes
    txt = txt.replace(/\bshadow-xs\b/g, 'shadow-sm');

    // In NON-globals files, unwrap any @layer blocks to plain CSS
    const isGlobals = /app[\\/]+globals\.css$/.test(file);
    if (!isGlobals) {
      txt = txt.replace(/@layer\s+(?:components|base|utilities)\s*\{([\s\S]*?)\}/gmi, '$1');
    }

    // In non-globals files, also ensure we don't carry stray @tailwind directives
    if (!isGlobals) {
      txt = txt.replace(/^\s*@tailwind\s+(?:base|components|utilities);\s*$/gmi, '');
    }

    if (txt !== orig) {
      fs.writeFileSync(file, txt, 'utf8');
      console.log('[fix-tailwind-classes] updated', path.relative(process.cwd(), file));
      changed++;
    }
  }
}

console.log('[fix-tailwind-classes] done. Files changed:', changed);
