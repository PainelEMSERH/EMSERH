import { canonUnidade } from '@/lib/unidReg';

/** CE (ex-CER) — CIPA por designação. */
export const CE_CIDADE_OPERARIA = 'CE Cidade Operária';

/** UPA + Policlínica unificadas — cronograma completo (12 itens). */
export const UPA_POLI_CIDADE_OPERARIA = 'UPA e Policlínica Cidade Operária';

const CE_ALIASES_CANON = new Set([
  'CE CIDADE OPERARIA',
  'CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA',
  'CER-CIDADE OPERARIA',
  'CER - CIDADE OPERARIA',
]);

const UPA_POLI_ALIASES_CANON = new Set([
  'UPA CIDADE OPERARIA',
  'POLICLINICA CIDADE OPERARIA',
  'SLZ-POLI-CIDADE OPERARIA',
  'UPA E POLICLINICA CIDADE OPERARIA',
]);

export function isCeCidadeOperariaCanon(c: string): boolean {
  if (!c) return false;
  if (c === canonUnidade(CE_CIDADE_OPERARIA)) return true;
  if (CE_ALIASES_CANON.has(c)) return true;
  if (!c.includes('CIDADE OPERARIA')) return false;
  if (c.includes('POLICLINICA') || c.includes('UPA')) return false;
  return c.includes('CER') || c.includes('REAB') || c.startsWith('CE ') || c.startsWith('CE-');
}

export function isUpaPoliMergeCanon(c: string): boolean {
  if (!c) return false;
  if (c === canonUnidade(UPA_POLI_CIDADE_OPERARIA)) return true;
  if (UPA_POLI_ALIASES_CANON.has(c)) return true;
  if (!c.includes('CIDADE OPERARIA')) return false;
  if (c.includes('UPA') && !c.includes('POLICLINICA')) return true;
  if (c.includes('POLICLINICA')) return true;
  return false;
}

/** Nome canônico exibido/gravado na CIPA. */
export function normalizeCipaUnidade(unidade: string | null | undefined): string {
  const raw = String(unidade ?? '').trim();
  if (!raw) return '';
  const c = canonUnidade(raw);
  if (isCeCidadeOperariaCanon(c)) return CE_CIDADE_OPERARIA;
  if (isUpaPoliMergeCanon(c)) return UPA_POLI_CIDADE_OPERARIA;
  return raw;
}

/** Nomes legados no banco que correspondem à unidade canônica. */
export function cipaUnidadeDbAliases(unidade: string): string[] {
  const norm = normalizeCipaUnidade(unidade);
  const out = new Set<string>([unidade.trim(), norm]);

  if (norm === CE_CIDADE_OPERARIA) {
    out.add(CE_CIDADE_OPERARIA);
    CE_ALIASES_CANON.forEach((a) => out.add(a));
    out.add('CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA');
    out.add('CER - CIDADE OPERÁRIA');
  }

  if (norm === UPA_POLI_CIDADE_OPERARIA) {
    out.add(UPA_POLI_CIDADE_OPERARIA);
    UPA_POLI_ALIASES_CANON.forEach((a) => out.add(a));
    out.add('UPA CIDADE OPERARIA');
    out.add('POLICLINICA CIDADE OPERARIA');
  }

  return [...out].filter(Boolean);
}

export function cipaUnidadeMatchSql(unidade: string, column = 'unidade'): string {
  const aliases = cipaUnidadeDbAliases(unidade);
  const parts = aliases.map((a) => `UPPER(TRIM(${column})) = UPPER('${String(a).replace(/'/g, "''")}')`);
  return `(${parts.join(' OR ')})`;
}
