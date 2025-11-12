// lib/format.ts
export function padMatricula(value: string | number): string {
  const v = String(value ?? '').replace(/\D/g, '');
  return v.padStart(5, '0').slice(-5);
}

export function formatDateBR(input?: string | Date | null): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function summarizeItems(items: Array<{ nome?: string; item?: string; quantidade?: number }>): string {
  if (!Array.isArray(items) || items.length === 0) return '-';
  const parts = items.slice(0, 3).map((it) => {
    const label = it?.nome || it?.item || 'Item';
    const q = it?.quantidade ?? 1;
    return `${label} x${q}`;
  });
  return items.length > 3 ? parts.join(', ') + '…' : parts.join(', ');
}

export function toNumber(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function downloadBlob(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
