export function toDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function toIsoDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoDateInputToBR(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

export function buildRiatCellValues(
  acidente: Record<string, unknown>,
  observacoes: string,
  numeroSinan: string,
  overrides: Partial<Record<string, string>> = {}
): Record<string, string> {
  const tipo = String(acidente.tipo ?? '');
  const comAfastamento = !!acidente.comAfastamento;
  const hoje = toDDMMYYYY(new Date().toISOString());

  const base: Record<string, string> = {
    dataInicialInvestigacao: hoje,
    dataFinalInvestigacao: hoje,
    responsavelInvestigacao: '',
    numeroSinan: String(numeroSinan ?? ''),
    nome: String(acidente.nome ?? ''),
    matricula: '',
    unidadeHospitalar: String(acidente.unidadeHospitalar ?? ''),
    funcaoTrabalhador: String(acidente.funcaoTrabalhador ?? ''),
    tempoFuncao: '',
    tempoExperiencia: '',
    telefone: '',
    data: toDDMMYYYY(acidente.data as string | undefined),
    hora: String(acidente.hora ?? ''),
    localAcidente: String(acidente.unidadeHospitalar ?? ''),
    especificacaoLocal: String(acidente.descricao ?? '').slice(0, 200),
    sesmtInformadoMotivo: '',
    horasTrabalhadasAteOcorrencia: '',
    diasTratamento: '',
    causaImediata: String(acidente.causaImediata ?? ''),
    parteCorpoLesionada: '',
    descricao: String(acidente.descricao ?? ''),
    tipo_tipico: tipo === 'tipico' ? 'X' : '',
    tipo_trajeto: tipo === 'trajeto' ? 'X' : '',
    tipo_biologico: tipo === 'biologico' ? 'X' : '',
    tipo_quimico: '',
    tipo_incidente: '',
    afastamento_sim: comAfastamento ? 'X' : '',
    afastamento_nao: !comAfastamento ? 'X' : '',
    fatorMaterial: String(acidente.fatoresContrib ?? ''),
    fatorHumano: String(observacoes ?? ''),
    circunstancias: String(acidente.descricao ?? '').slice(0, 500),
    impacto: '',
    causaRaiz: String(acidente.causaRaiz ?? ''),
    acoesCorretivas: String(observacoes ?? ''),
  };

  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined && v !== '') out[k] = v;
  }
  return out;
}
