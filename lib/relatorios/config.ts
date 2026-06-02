// Configuração modular de relatórios
// Cada módulo define suas colunas disponíveis e como buscar os dados

export type ColumnType = 'text' | 'number' | 'date' | 'currency' | 'boolean';

export interface ReportColumn {
  id: string;
  label: string;
  type: ColumnType;
  description?: string;
  width?: number; // largura sugerida no Excel
}

export interface ReportModule {
  id: string;
  name: string;
  description: string;
  icon?: string;
  enabled: boolean; // se o módulo está ativo/disponível
  columns: ReportColumn[];
  fetchData: (filters: ReportFilters) => Promise<any[]>;
}

export interface ReportFilters {
  regional?: string;
  unidade?: string;
  de?: string;
  ate?: string;
  [key: string]: any; // filtros adicionais por módulo
}

// Configuração de colunas para o módulo de Entregas
export const ENTREGAS_COLUMNS: ReportColumn[] = [
  { id: 'data_entrega', label: 'Data da Entrega', type: 'date', description: 'Data em que foi entregue', width: 15 },
  { id: 'cpf', label: 'CPF', type: 'text', description: 'CPF do colaborador', width: 15 },
  { id: 'nome', label: 'Nome', type: 'text', description: 'Nome completo do colaborador', width: 30 },
  { id: 'matricula', label: 'Matrícula', type: 'text', description: 'Matrícula do colaborador', width: 15 },
  { id: 'funcao', label: 'Função', type: 'text', description: 'Função/cargo do colaborador', width: 25 },
  { id: 'funcao_normalizada', label: 'Função normalizada', type: 'text', description: 'Função no mapa EPI', width: 22 },
  { id: 'unidade', label: 'Unidade', type: 'text', description: 'Unidade de lotação', width: 30 },
  { id: 'regional', label: 'Regional', type: 'text', description: 'Regional responsável', width: 15 },
  { id: 'item', label: 'EPI/Item', type: 'text', description: 'Nome do EPI entregue', width: 35 },
  { id: 'quantidade', label: 'Quantidade', type: 'number', description: 'Quantidade neste lançamento', width: 12 },
  { id: 'qty_required', label: 'Quantidade Requerida', type: 'number', description: 'Quantidade prevista no kit', width: 18 },
  { id: 'qty_delivered', label: 'Total Entregue', type: 'number', description: 'Total já entregue ao colaborador', width: 15 },
  { id: 'qtd_pendente', label: 'Pendente', type: 'number', description: 'Falta entregar', width: 12 },
  { id: 'entregue_por', label: 'Registrado por', type: 'text', description: 'Usuário que registrou', width: 22 },
  { id: 'entregue_em', label: 'Registrado em', type: 'text', description: 'Data/hora do registro', width: 18 },
  { id: 'obrigatorio', label: 'EPI Obrigatório', type: 'boolean', description: 'Se o EPI é obrigatório para meta', width: 15 },
  { id: 'origem_colaborador', label: 'Origem', type: 'text', description: 'Alterdata ou Manual', width: 12 },
  { id: 'admissao', label: 'Data Admissão', type: 'date', description: 'Data de admissão', width: 15 },
  { id: 'demissao', label: 'Data Demissão', type: 'date', description: 'Data de demissão (se houver)', width: 15 },
  { id: 'setores_no_mapa', label: 'Setores no mapa', type: 'text', description: 'Setores possíveis no mapa EPI', width: 28 },
  { id: 'pcgs_no_mapa', label: 'PCGs no mapa', type: 'text', description: 'PCGs vinculados à função', width: 22 },
  { id: 'observacao_kit', label: 'Obs. kit/setor', type: 'text', description: 'Limitações do mapeamento', width: 40 },
];

// Configuração de colunas para módulos futuros (placeholders)
export const SPCI_COLUMNS: ReportColumn[] = [
  { id: 'unidade', label: 'Unidade', type: 'text', width: 30 },
  { id: 'regional', label: 'Regional', type: 'text', width: 15 },
  { id: 'tipo_extintor', label: 'Tipo de Extintor', type: 'text', width: 20 },
  { id: 'capacidade', label: 'Capacidade', type: 'text', width: 15 },
  { id: 'localizacao', label: 'Localização', type: 'text', width: 30 },
  { id: 'data_vencimento', label: 'Data Vencimento', type: 'date', width: 18 },
  { id: 'ultima_inspecao', label: 'Última Inspeção', type: 'date', width: 18 },
  { id: 'proxima_inspecao', label: 'Próxima Inspeção', type: 'date', width: 18 },
  { id: 'status', label: 'Status', type: 'text', width: 15 },
];

export const CIPA_COLUMNS: ReportColumn[] = [
  { id: 'nome', label: 'Nome', type: 'text', width: 30 },
  { id: 'cpf', label: 'CPF', type: 'text', width: 15 },
  { id: 'funcao', label: 'Função', type: 'text', width: 25 },
  { id: 'unidade', label: 'Unidade', type: 'text', width: 30 },
  { id: 'cargo_cipa', label: 'Cargo na CIPA', type: 'text', width: 20 },
  { id: 'data_eleicao', label: 'Data Eleição', type: 'date', width: 18 },
  { id: 'data_fim_mandato', label: 'Fim do Mandato', type: 'date', width: 18 },
  { id: 'status', label: 'Status', type: 'text', width: 15 },
];

export const ACIDENTES_COLUMNS: ReportColumn[] = [
  { id: 'data_acidente', label: 'Data do Acidente', type: 'date', width: 18 },
  { id: 'nome', label: 'Colaborador', type: 'text', width: 30 },
  { id: 'cpf', label: 'CPF', type: 'text', width: 15 },
  { id: 'funcao', label: 'Função', type: 'text', width: 25 },
  { id: 'unidade', label: 'Unidade', type: 'text', width: 30 },
  { id: 'tipo_acidente', label: 'Tipo', type: 'text', width: 20 },
  { id: 'gravidade', label: 'Gravidade', type: 'text', width: 15 },
  { id: 'descricao', label: 'Descrição', type: 'text', width: 50 },
  { id: 'causa', label: 'Causa', type: 'text', width: 30 },
  { id: 'medidas_corretivas', label: 'Medidas Corretivas', type: 'text', width: 40 },
];

export const ORDENS_SERVICO_COLUMNS: ReportColumn[] = [
  { id: 'numero', label: 'Número OS', type: 'text', width: 15 },
  { id: 'data_abertura', label: 'Data Abertura', type: 'date', width: 18 },
  { id: 'data_fechamento', label: 'Data Fechamento', type: 'date', width: 18 },
  { id: 'unidade', label: 'Unidade', type: 'text', width: 30 },
  { id: 'regional', label: 'Regional', type: 'text', width: 15 },
  { id: 'tipo_servico', label: 'Tipo de Serviço', type: 'text', width: 25 },
  { id: 'descricao', label: 'Descrição', type: 'text', width: 50 },
  { id: 'solicitante', label: 'Solicitante', type: 'text', width: 25 },
  { id: 'status', label: 'Status', type: 'text', width: 15 },
  { id: 'prioridade', label: 'Prioridade', type: 'text', width: 15 },
];

// Configuração de módulos disponíveis
export const REPORT_MODULES: Omit<ReportModule, 'fetchData'>[] = [
  {
    id: 'entregas',
    name: 'Entregas de EPI',
    description: 'Relatório detalhado de todas as entregas de EPI realizadas',
    icon: '📦',
    enabled: true,
    columns: ENTREGAS_COLUMNS,
  },
  {
    id: 'spci',
    name: 'SPCI - Extintores',
    description: 'Relatório de extintores e inspeções SPCI',
    icon: '🔥',
    enabled: false, // Será habilitado quando a página estiver pronta
    columns: SPCI_COLUMNS,
  },
  {
    id: 'cipa',
    name: 'CIPA',
    description: 'Relatório de membros e atividades da CIPA',
    icon: '👥',
    enabled: false, // Será habilitado quando a página estiver pronta
    columns: CIPA_COLUMNS,
  },
  {
    id: 'acidentes',
    name: 'Acidentes',
    description: 'Relatório de acidentes de trabalho registrados',
    icon: '⚠️',
    enabled: true,
    columns: ACIDENTES_COLUMNS,
  },
  {
    id: 'ordens_servico',
    name: 'Ordens de Serviço',
    description: 'Relatório de ordens de serviço abertas e executadas',
    icon: '🔧',
    enabled: true,
    columns: ORDENS_SERVICO_COLUMNS,
  },
];
