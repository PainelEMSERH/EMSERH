import { canonUnidade } from '@/lib/unidReg';

/** CE (ex-CER / Centro Especializado de Reab.) — CIPA por designação. */
export const CE_CIDADE_OPERARIA = 'CE CIDADE OPERARIA';

/** UPA + Policlínica unificadas — cronograma completo (12 itens). */
export const UPA_POLI_CIDADE_OPERARIA = 'UPA E POLICLINICA CIDADE OPERARIA';

/** Nomes legados no banco → CE CIDADE OPERARIA */
const CE_ALIASES_CANON = new Set([
  'CE CIDADE OPERARIA',
  'CE-CIDADE OPERARIA',
  'CER CIDADE OPERARIA',
  'CER-CIDADE OPERARIA',
  'CER - CIDADE OPERARIA',
  'CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA',
  'CENTRO ESPECIALIZADO DE REABILITACAO CIDADE OPERARIA',
]);

const UPA_POLI_ALIASES_CANON = new Set([
  'UPA CIDADE OPERARIA',
  'POLICLINICA CIDADE OPERARIA',
  'SLZ-POLI-CIDADE OPERARIA',
  'UPA E POLICLINICA CIDADE OPERARIA',
]);

function isCerOlhoDAgua(c: string): boolean {
  return c.includes('OLHO') && c.includes('D AGUA');
}

export function isCeCidadeOperariaCanon(c: string): boolean {
  if (!c) return false;
  if (CE_ALIASES_CANON.has(c)) return true;
  if (!c.includes('CIDADE OPERARIA')) return false;
  if (c.includes('POLICLINICA') || c.includes('UPA')) return false;
  if (isCerOlhoDAgua(c)) return false;

  if (/^CE(\s|-)+CIDADE\s+OPERARIA$/.test(c)) return true;
  if (/^CER(\s|-)+CIDADE\s+OPERARIA$/.test(c)) return true;
  if (c.includes('CENTRO ESPECIALIZADO') && c.includes('REAB')) return true;
  if (c.includes('CER') && c.includes('CIDADE OPERARIA')) return true;

  return false;
}

export function isUpaPoliMergeCanon(c: string): boolean {
  if (!c) return false;
  if (c === UPA_POLI_CIDADE_OPERARIA) return true;
  if (UPA_POLI_ALIASES_CANON.has(c)) return true;
  if (!c.includes('CIDADE OPERARIA')) return false;
  if (c.includes('UPA') && !c.includes('POLICLINICA')) return true;
  if (c.includes('POLICLINICA')) return true;
  return false;
}

/** Nome canônico exibido/gravado na CIPA (sempre maiúsculo). */
export function normalizeCipaUnidade(unidade: string | null | undefined): string {
  const raw = String(unidade ?? '').trim();
  if (!raw) return '';
  const c = canonUnidade(raw);
  if (isCeCidadeOperariaCanon(c)) return CE_CIDADE_OPERARIA;
  if (isUpaPoliMergeCanon(c)) return UPA_POLI_CIDADE_OPERARIA;
  return raw.toUpperCase();
}

/** Nomes legados no banco que correspondem à unidade canônica. */
export function cipaUnidadeDbAliases(unidade: string): string[] {
  const norm = normalizeCipaUnidade(unidade);
  const out = new Set<string>([unidade.trim(), norm]);

  if (norm === CE_CIDADE_OPERARIA) {
    CE_ALIASES_CANON.forEach((a) => out.add(a));
    out.add('CER - CIDADE OPERÁRIA');
    out.add('CER - CIDADE OPERARIA');
  }

  if (norm === UPA_POLI_CIDADE_OPERARIA) {
    UPA_POLI_ALIASES_CANON.forEach((a) => out.add(a));
    out.add('SLZ-POLI-CIDADE OPERÁRIA');
  }

  return [...out].filter(Boolean);
}

export function cipaUnidadeMatchSql(unidade: string, column = 'unidade'): string {
  const aliases = cipaUnidadeDbAliases(unidade);
  const parts = aliases.map((a) => `UPPER(TRIM(${column})) = UPPER('${String(a).replace(/'/g, "''")}')`);
  return `(${parts.join(' OR ')})`;
}
