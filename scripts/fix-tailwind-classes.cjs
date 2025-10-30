// Fix Tailwind v4-specific CSS so Tailwind v3 compiles on Vercel
const fs = require('fs');
const path = require('path');

const CSS_DIRS = [
  path.join(process.cwd(), 'app'),
  path.join(process.cwd(), 'components'),
];

const breakpoints = {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
  '2xl': '1536px',
};

function replaceThemeBreakpoints(css) {
  // Replace @media (width >= theme(--breakpoint-md)) with @screen md
  css = css.replace(/@media\s*\(\s*width\s*>=\s*theme\(\s*--breakpoint-([a-z0-9]+)\s*\)\s*\)\s*\{/gi, (m, bp) => {
    return `@screen ${bp} {`;
  });
  // Fallback: replace theme(--breakpoint-xx) with px values (min-width style), if any remain.
  css = css.replace(/theme\(\s*--breakpoint-([a-z0-9]+)\s*\)/gi, (m, bp) => {
    const px = breakpoints[bp] || '768px';
    return px;
  });
  return css;
}

function removeLayerWrappersOutsideGlobals(filePath, css) {
  const isGlobals = /app[\/]+globals\.css$/.test(filePath);
  if (isGlobals) return css;

  // Unwrap @layer ... { ... } by removing the outer wrapper but keeping content.
  css = css.replace(/@layer\s+(base|components|utilities)\s*\{([\s\S]*?)\}/gi, (m, layer, inner) => inner);

  // Remove any stray @tailwind directives outside globals
  css = css.replace(/@tailwind\s+(base|components|utilities)\s*;?/gi, '');

  return css;
}

function dropImportsOfAdditionalStyles(globalsPath) {
  if (!fs.existsSync(globalsPath)) return;
  let css = fs.readFileSync(globalsPath, 'utf8');
  const before = css;
  // Remove imports to additional-styles or app/styles
  css = css.replace(/@import\s+["']\.?\/?(?:app\/)?(?:additional-styles|styles)(?:\/[^"']*)?["'];?\s*/gi, '');

  if (css !== before) {
    fs.writeFileSync(globalsPath, css, 'utf8');
    console.log('[fix-tailwind-classes] removed @import to additional-styles/* from globals.css');
  }
}

function processFile(filePath) {
  let css = fs.readFileSync(filePath, 'utf8');

  // Remove Tailwind v4 directives
  css = css.replace(/@import\s+["']tailwindcss["'];?\s*/g, '');
  css = css.replace(/@config\s+["'][^"']+["'];?\s*/g, '');

  // Fix invalid class names
  css = css.replace(/\bshadow-xs\b/g, 'shadow-sm');

  // Replace theme(--breakpoint-*) usage
  css = replaceThemeBreakpoints(css);

  // Unwrap @layer in non-globals files and drop @tailwind there
  css = removeLayerWrappersOutsideGlobals(filePath, css);

  // If after replacements still has theme(--breakpoint-), force-convert remaining @media blocks to min-width hardcoded
  css = css.replace(/@media\s*\([^)]*theme\(\s*--breakpoint-([a-z0-9]+)\s*\)[^)]*\)\s*\{/gi, (m, bp) => {
    const px = breakpoints[bp] || '768px';
    return `@media (min-width: ${px}) {`;
  });

  fs.writeFileSync(filePath, css, 'utf8');
}

function walk(dir) {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && /\.css$/.test(e.name)) processFile(p);
  }
}

for (const d of CSS_DIRS) walk(d);

// Finally, remove imports of additional-styles from globals.css to avoid any leftover v4-only patterns
dropImportsOfAdditionalStyles(path.join(process.cwd(), 'app', 'globals.css'));

console.log('[fix-tailwind-classes] pass complete');
