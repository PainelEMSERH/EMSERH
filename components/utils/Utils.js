// Utility color helpers used by ChartjsConfig
// Safe, no exceptions. Returns sensible defaults on bad input.

export function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hslToHex(h, s, l) {
  // accepts h in [0..360], s/l in [0..100]
  h = Number(h); s = Number(s); l = Number(l);
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c/2;
  let r=0, g=0, b=0;
  if (0 <= h && h < 60) { r=c; g=x; b=0; }
  else if (60 <= h && h < 120) { r=x; g=c; b=0; }
  else if (120 <= h && h < 180) { r=0; g=c; b=x; }
  else if (180 <= h && h < 240) { r=0; g=x; b=c; }
  else if (240 <= h && h < 300) { r=x; g=0; b=c; }
  else { r=c; g=0; b=x; }
  const toHex = v => {
    const hv = Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return hv;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}