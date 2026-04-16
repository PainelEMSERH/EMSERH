export type GstBucket =
  | 'no_prazo'
  | 'em_atraso'
  | 'concluido'
  | 'atraso_reprogramado'
  | 'cancelado'
  | 'outros';

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Classifica texto de status da planilha em buckets do painel GST. */
export function classifyGstStatus(statusRaw: string | null | undefined): GstBucket {
  const s = norm(String(statusRaw ?? ''));
  if (!s) return 'outros';
  if (s.includes('cancel')) return 'cancelado';
  if (s.includes('conclu') || s.includes('finaliz') || s === 'feito') return 'concluido';
  if (s.includes('reprogram') || (s.includes('atraso') && s.includes('reprog'))) return 'atraso_reprogramado';
  if (s.includes('atraso') || s.includes('atrasada')) return 'em_atraso';
  if (s.includes('prazo') || s.includes('em dia') || s.includes('andamento') || s.includes('aberto'))
    return 'no_prazo';
  return 'outros';
}

export function aggregateGstBuckets(rows: { status: string; c: number }[]) {
  let no_prazo = 0;
  let em_atraso = 0;
  let concluido = 0;
  let atraso_reprogramado = 0;
  let cancelado = 0;
  let outros = 0;

  for (const r of rows) {
    const b = classifyGstStatus(r.status);
    const n = Number(r.c || 0);
    switch (b) {
      case 'no_prazo':
        no_prazo += n;
        break;
      case 'em_atraso':
        em_atraso += n;
        break;
      case 'concluido':
        concluido += n;
        break;
      case 'atraso_reprogramado':
        atraso_reprogramado += n;
        break;
      case 'cancelado':
        cancelado += n;
        break;
      default:
        outros += n;
    }
  }
  no_prazo += outros;

  const total = no_prazo + em_atraso + concluido + atraso_reprogramado + cancelado;
  return { total, no_prazo, em_atraso, concluido, atraso_reprogramado, cancelado };
}
