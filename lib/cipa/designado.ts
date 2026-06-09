import { canonUnidade } from '@/lib/unidReg';

/** Atividades do fluxo CIPA por designação (sem eleição). */
export const DESIGNADO_ACTIVITY_CODES = [1, 9, 10, 11, 12] as const;

export type DesignadoActivityCode = (typeof DESIGNADO_ACTIVITY_CODES)[number];

/** Nomes exibidos no cronograma de unidades designadas. */
export const DESIGNADO_ACTIVITY_NAMES: Record<DesignadoActivityCode, string> = {
  1: 'Ofício Comunicação à Unidade e Sindicato',
  9: 'Solicitação do Indicado (Designado) pelo Empregador',
  10: 'Treinamento da CIPA (Designado)',
  11: 'Emissão Certificado',
  12: 'Reunião de Posse (Designado)',
};

/** Chaves canônicas das unidades com CIPA por designação. */
const DESIGNADO_UNITS_CANON = new Set([
  'PROGRAMA DE ACAO INTEGRADA PARA APOSENTADOS-PAI',
  'PROGRAMA DE ATENCAO INTEGRADA AOS APOSENTADOS-PAI',
  'CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA',
  'CER-CIDADE OPERARIA',
  'CAF-FEME',
  'CAF FEME',
  'CASA TEA 12+',
  'SLZ-TEA-COHAB',
  'TEA 12+ COHAB',
  'HOSPITAL DE PAULINO NEVES',
  'INT-HOSP-PAULINO NEVES',
]);

export function isDesignadoUnit(unidade: string | null | undefined): boolean {
  const c = canonUnidade(unidade);
  if (!c) return false;
  if (DESIGNADO_UNITS_CANON.has(c)) return true;

  if ((c.includes('PAI') || c.includes('APOSENTAD')) && c.includes('PROGRAMA')) return true;
  if (c.includes('CIDADE OPERARIA') && (c.includes('CER') || c.includes('REAB'))) return true;
  if (c === 'CAF-FEME' || (c.startsWith('CAF') && c.includes('FEME') && !c.includes('SEDE'))) return true;
  if (c === 'CASA TEA 12+' || c === 'SLZ-TEA-COHAB' || (c.includes('TEA') && c.includes('12') && c.includes('COHAB'))) {
    return true;
  }
  if (c.includes('PAULINO NEVES') && c.includes('HOSPITAL')) return true;

  return false;
}

export function isDesignadoActivityCode(codigo: number): codigo is DesignadoActivityCode {
  return (DESIGNADO_ACTIVITY_CODES as readonly number[]).includes(codigo);
}

type CipaRowLike = {
  unidade: string;
  atividade_codigo: number;
  atividade_nome?: string;
};

/** Mantém só as 5 atividades válidas para unidades designadas. */
export function filterDesignadoRows<T extends CipaRowLike>(rows: T[]): T[] {
  return rows
    .filter((r) => !isDesignadoUnit(r.unidade) || isDesignadoActivityCode(r.atividade_codigo))
    .map((r) => {
      if (!isDesignadoUnit(r.unidade) || !isDesignadoActivityCode(r.atividade_codigo)) return r;
      return {
        ...r,
        atividade_nome: DESIGNADO_ACTIVITY_NAMES[r.atividade_codigo],
      };
    });
}

/** Códigos de atividade que não se aplicam a unidades designadas. */
export const DESIGNADO_EXCLUDED_CODES = [2, 3, 4, 5, 6, 7, 8];
