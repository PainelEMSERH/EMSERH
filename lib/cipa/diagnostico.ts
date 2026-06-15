export type DiagnosticoItem = {
  unidade: string;
  atividade_codigo: number;
  atividade_nome: string;
  data_fim_prevista: string;
  data_conclusao: string | null;
  status: 'executada' | 'pendente';
};

export type DiagnosticoPorUnidade = {
  unidade: string;
  executadas: number;
  pendentes: number;
  itens: DiagnosticoItem[];
};

type RowIn = {
  unidade: string;
  atividade_codigo: number;
  atividade_nome: string;
  data_fim_prevista: string | null;
  data_conclusao: string | null;
};

function monthFromFim(iso: string | null | undefined, ano: number): string | null {
  if (!iso) return null;
  const s = String(iso).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split('-').map(Number);
  if (y !== ano || m < 1 || m > 12) return null;
  return String(m).padStart(2, '0');
}

/** Atividades cuja data fim prevista cai no mês selecionado. */
export function computeDiagnosticoMes(rows: RowIn[], ano: number, mes: string) {
  const itens: DiagnosticoItem[] = [];

  for (const row of rows) {
    if (monthFromFim(row.data_fim_prevista, ano) !== mes) continue;
    const fim = String(row.data_fim_prevista).slice(0, 10);
    itens.push({
      unidade: row.unidade,
      atividade_codigo: row.atividade_codigo,
      atividade_nome: row.atividade_nome,
      data_fim_prevista: fim,
      data_conclusao: row.data_conclusao ? String(row.data_conclusao).slice(0, 10) : null,
      status: row.data_conclusao ? 'executada' : 'pendente',
    });
  }

  itens.sort((a, b) => {
    if (a.unidade !== b.unidade) return a.unidade.localeCompare(b.unidade);
    return a.atividade_codigo - b.atividade_codigo;
  });

  const porUnidadeMap = new Map<string, DiagnosticoPorUnidade>();
  for (const item of itens) {
    const cur = porUnidadeMap.get(item.unidade) ?? {
      unidade: item.unidade,
      executadas: 0,
      pendentes: 0,
      itens: [],
    };
    if (item.status === 'executada') cur.executadas += 1;
    else cur.pendentes += 1;
    cur.itens.push(item);
    porUnidadeMap.set(item.unidade, cur);
  }

  const porUnidade = [...porUnidadeMap.values()].sort((a, b) => {
    if (b.pendentes !== a.pendentes) return b.pendentes - a.pendentes;
    return a.unidade.localeCompare(b.unidade);
  });

  const executadas = itens.filter((i) => i.status === 'executada').length;
  const pendentes = itens.length - executadas;

  return {
    total: itens.length,
    executadas,
    pendentes,
    itens,
    porUnidade,
  };
}
