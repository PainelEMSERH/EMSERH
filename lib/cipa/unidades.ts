import { canonUnidade } from '@/lib/unidReg';
import { isDesignadoActivityCode } from '@/lib/cipa/designado';

/** CE (ex-CER + legado Policlínica designado) — CIPA por designação. */
export const CE_CIDADE_OPERARIA = 'CE CIDADE OPERARIA';

/** UPA + Policlínica (itens de eleição) — cronograma completo (12 itens). */
export const UPA_POLI_CIDADE_OPERARIA = 'UPA E POLICLINICA CIDADE OPERARIA';

const CE_ALIASES_CANON = new Set([
  'CE CIDADE OPERARIA',
  'CE-CIDADE OPERARIA',
  'CER CIDADE OPERARIA',
  'CER-CIDADE OPERARIA',
  'CER - CIDADE OPERARIA',
  'CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA',
  'CENTRO ESPECIALIZADO DE REABILITACAO CIDADE OPERARIA',
]);

const POLI_CIDADE_OPERARIA_ALIASES = new Set([
  'POLICLINICA CIDADE OPERARIA',
  'SLZ-POLI-CIDADE OPERARIA',
]);

const UPA_ALIASES_CANON = new Set(['UPA CIDADE OPERARIA', 'UPA E POLICLINICA CIDADE OPERARIA']);

function isCerOlhoDAgua(c: string): boolean {
  return c.includes('OLHO') && c.includes('D AGUA');
}

export function isPoliCidadeOperariaLegacy(c: string): boolean {
  if (!c.includes('CIDADE OPERARIA')) return false;
  if (POLI_CIDADE_OPERARIA_ALIASES.has(c)) return true;
  return c.includes('POLICLINICA') || c.includes('SLZ-POLI');
}

export function isCeCidadeOperariaCanon(c: string): boolean {
  if (!c) return false;
  if (CE_ALIASES_CANON.has(c)) return true;
  if (!c.includes('CIDADE OPERARIA')) return false;
  if (c.includes('UPA')) return false;
  if (isCerOlhoDAgua(c)) return false;
  if (isPoliCidadeOperariaLegacy(c)) return false;

  if (/^CE(\s|-)+CIDADE\s+OPERARIA$/.test(c)) return true;
  if (/^CER(\s|-)+CIDADE\s+OPERARIA$/.test(c)) return true;
  if (c.includes('CENTRO ESPECIALIZADO') && c.includes('REAB')) return true;
  if (c.includes('CER') && c.includes('CIDADE OPERARIA')) return true;

  return false;
}

export function isUpaCidadeOperariaCanon(c: string): boolean {
  if (!c) return false;
  if (UPA_ALIASES_CANON.has(c)) return true;
  return c.includes('CIDADE OPERARIA') && c.includes('UPA') && !c.includes('POLICLINICA');
}

/** Nome legado combinado CE + Policlínica (planilha antiga). */
function isCePoliCombinedLegacy(c: string): boolean {
  return c.includes('CIDADE OPERARIA') && c.includes('CE') && c.includes('POLICLINICA');
}

/**
 * Define unidade canônica considerando legado:
 * - CER/CE → CE CIDADE OPERARIA
 * - Policlínica C.O.: itens designado (1,9,10,11,12) → CE; demais → UPA+Poli
 */
export function resolveCipaUnidade(
  unidade: string | null | undefined,
  atividadeCodigo?: number,
): string {
  const raw = String(unidade ?? '').trim();
  if (!raw) return '';
  const c = canonUnidade(raw);

  if (isCeCidadeOperariaCanon(c)) return CE_CIDADE_OPERARIA;

  if (isCePoliCombinedLegacy(c)) {
    if (atividadeCodigo != null && isDesignadoActivityCode(atividadeCodigo)) return CE_CIDADE_OPERARIA;
    if (atividadeCodigo != null && atividadeCodigo >= 2 && atividadeCodigo <= 8) return UPA_POLI_CIDADE_OPERARIA;
    if (atividadeCodigo === 12) return CE_CIDADE_OPERARIA;
    return CE_CIDADE_OPERARIA;
  }

  if (isPoliCidadeOperariaLegacy(c)) {
    if (atividadeCodigo == null || isDesignadoActivityCode(atividadeCodigo)) {
      return CE_CIDADE_OPERARIA;
    }
    return UPA_POLI_CIDADE_OPERARIA;
  }

  if (isUpaCidadeOperariaCanon(c)) return UPA_POLI_CIDADE_OPERARIA;

  return raw.toUpperCase();
}

/** @deprecated Use resolveCipaUnidade — mantido para chamadas sem código de atividade. */
export function normalizeCipaUnidade(unidade: string | null | undefined): string {
  return resolveCipaUnidade(unidade);
}

export function cipaUnidadeDbAliases(unidade: string): string[] {
  const norm = resolveCipaUnidade(unidade);
  const out = new Set<string>([unidade.trim(), norm]);

  if (norm === CE_CIDADE_OPERARIA) {
    CE_ALIASES_CANON.forEach((a) => out.add(a));
    POLI_CIDADE_OPERARIA_ALIASES.forEach((a) => out.add(a));
    out.add('CER - CIDADE OPERÁRIA');
    out.add('CER - CIDADE OPERARIA');
    out.add('CE E POLICLINICA CIDADE OPERARIA');
  }

  if (norm === UPA_POLI_CIDADE_OPERARIA) {
    UPA_ALIASES_CANON.forEach((a) => out.add(a));
    POLI_CIDADE_OPERARIA_ALIASES.forEach((a) => out.add(a));
    out.add('SLZ-POLI-CIDADE OPERÁRIA');
  }

  return [...out].filter(Boolean);
}

export function cipaUnidadeMatchSql(unidade: string, column = 'unidade'): string {
  const aliases = cipaUnidadeDbAliases(unidade);
  const parts = aliases.map((a) => `UPPER(TRIM(${column})) = UPPER('${String(a).replace(/'/g, "''")}')`);
  return `(${parts.join(' OR ')})`;
}
