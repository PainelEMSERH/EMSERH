import prisma from '@/lib/prisma';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';
import { findBestFunctionMatch } from '@/lib/functionMatcher';

export type KitPrevistoItem = { item: string; quantidade: number; obrigatorio: boolean };

type KitRow = {
  funcao: string;
  funcao_norm?: string;
  item: string;
  qtd: number;
  pcg: string;
  unidade_hosp: string;
};

function normKey(s: unknown): string {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function normFuncKey(s: unknown): string {
  const raw = (s ?? '').toString();
  const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
  return normKey(cleaned);
}

function isSemSetorBase(s: unknown): boolean {
  const v = String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return v.includes('SEM SETOR');
}

function isPcgUniversal(s: unknown): boolean {
  const v = String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return v.includes('PCG UNIVERSAL');
}

let kitRowsCache: { rows: KitRow[]; ts: number } | null = null;
const KIT_TTL_MS = 10 * 60 * 1000;

export async function loadKitRows(): Promise<KitRow[]> {
  const now = Date.now();
  if (kitRowsCache && now - kitRowsCache.ts < KIT_TTL_MS) {
    return kitRowsCache.rows;
  }
  const raw = await prisma.$queryRawUnsafe<KitRow[]>(`
    SELECT
      COALESCE(alterdata_funcao::text, '') AS funcao,
      COALESCE(funcao_normalizada::text, '') AS funcao_norm,
      COALESCE(epi_item::text, '') AS item,
      COALESCE(quantidade::numeric, 1)::float AS qtd,
      COALESCE(pcg::text, '') AS pcg,
      COALESCE(unidade_hospitalar::text, '') AS unidade_hosp
    FROM stg_epi_map
  `);
  kitRowsCache = { rows: raw || [], ts: now };
  return kitRowsCache.rows;
}

/**
 * Kit previsto base (igual meta 2026): PCG UNIVERSAL + setor genérico quando setor ainda não foi escolhido na entrega.
 * Na tela "Entregar", o kit pode mudar conforme o setor selecionado.
 */
export function getKitPrevistoForFuncao(funcaoRaw: string, kitRows: KitRow[]): KitPrevistoItem[] {
  const funcao = String(funcaoRaw || '').trim();
  if (!funcao) return [];

  const funcKey = normFuncKey(funcao);
  const allFunctions = Array.from(
    new Set(
      kitRows
        .flatMap((r) => [r.funcao, r.funcao_norm])
        .map((x) => String(x || '').trim())
        .filter(Boolean),
    ),
  );

  let finalFuncKey = funcKey;
  const matchedFunc = findBestFunctionMatch(funcao, allFunctions);
  if (matchedFunc) finalFuncKey = normFuncKey(matchedFunc);

  const semSetorRows: KitRow[] = [];
  const anySetorRows: KitRow[] = [];

  for (const r of kitRows) {
    const rFuncKey = normFuncKey(r.funcao_norm || r.funcao || '');
    const rFuncAlt = normFuncKey(r.funcao || '');
    if (rFuncKey !== finalFuncKey && rFuncAlt !== finalFuncKey) continue;

    const item = String(r.item || '').trim();
    if (!item || item.toUpperCase() === 'SEM EPI') continue;
    if (!isPcgUniversal(r.pcg)) continue;

    if (isSemSetorBase(r.unidade_hosp)) semSetorRows.push(r);
    anySetorRows.push(r);
  }

  const baseRows = semSetorRows.length > 0 ? semSetorRows : anySetorRows;
  const byItem = new Map<string, KitPrevistoItem>();

  for (const r of baseRows) {
    const item = String(r.item || '').trim();
    const quantidade = Math.max(1, Number(r.qtd || 1) || 1);
    const itemKey = normKey(item);
    const existing = byItem.get(itemKey);
    if (!existing || quantidade > existing.quantidade) {
      byItem.set(itemKey, {
        item,
        quantidade,
        obrigatorio: isEpiObrigatorio(item),
      });
    }
  }

  return Array.from(byItem.values()).sort((a, b) => a.item.localeCompare(b.item, 'pt-BR'));
}
