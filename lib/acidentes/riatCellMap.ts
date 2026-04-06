/**
 * Mapa célula → campo para o modelo RIAT oficial (.xlsx em public/modelos ou public/templates).
 * Ajustado para não colocar Lotação na linha de Matrícula: Nome B7; Matrícula B9; Lotação B10; …
 */
export function getRiatCellMap(): Record<string, string> {
  return {
    H3: 'dataInicialInvestigacao',
    I3: 'dataFinalInvestigacao',
    C5: 'responsavelInvestigacao',
    F6: 'numeroSinan',
    B7: 'nome',
    B9: 'matricula',
    B10: 'unidadeHospitalar',
    B11: 'funcaoTrabalhador',
    B12: 'tempoFuncao',
    B13: 'tempoExperiencia',
    B15: 'data',
    D15: 'hora',
    B16: 'localAcidente',
    G16: 'especificacaoLocal',
    G18: 'sesmtInformadoMotivo',
    D20: 'horasTrabalhadasAteOcorrencia',
    I20: 'diasTratamento',
    G22: 'causaImediata',
    D22: 'parteCorpoLesionada',
    B26: 'descricao',
    B21: 'tipo_tipico',
    C21: 'tipo_trajeto',
    D21: 'tipo_biologico',
    E21: 'tipo_quimico',
    F21: 'tipo_incidente',
    G20: 'afastamento_sim',
    H20: 'afastamento_nao',
    B37: 'fatorMaterial',
    B39: 'fatorHumano',
    B54: 'circunstancias',
    B55: 'impacto',
    B56: 'causaRaiz',
    B57: 'acoesCorretivas',
  };
}

export const RIAT_CAT_CELL = 'F5';
