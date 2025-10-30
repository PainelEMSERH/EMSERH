// scripts/fix-tailwind-classes.cjs
const fs = require('fs'); const path = require('path');
function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) files = files.concat(walk(p));
    else if (item.isFile() && p.endsWith('.css')) files.push(p);
  }
  return files;
}
const roots = ['app', 'components'];
let changed = 0;
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    let txt = fs.readFileSync(file, 'utf8');
    const orig = txt;
    // remove Tailwind v4 imports & @config
    txt = txt.replace(/^\s*@import\s+["']tailwindcss(?:\/[a-z-]+)?["'];?\s*$/gmi, '');
    txt = txt.replace(/^\s*@config\s+["'][^"']+["'];?\s*$/gmi, '');
    // replace unsupported classes
    txt = txt.replace(/\bshadow-xs\b/g, 'shadow-sm');
    // ensure @layer components for utility-patterns.css
    if (file.includes(path.join('additional-styles','utility-patterns.css'))) {
      if (!/@layer\s+components\s*\{/.test(txt)) {
        txt = '@layer components {\n' + txt + '\n}\n';
      }
    }
    if (txt !== orig) {
      fs.writeFileSync(file, txt, 'utf8'); changed++;
      console.log('[fix-tailwind-classes] updated', path.relative(process.cwd(), file));
    }
  }
}
console.log('[fix-tailwind-classes] done. Files changed:', changed);
