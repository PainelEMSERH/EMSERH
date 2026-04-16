/**
 * Mapeamento de cabeçalhos da planilha GST → colunas plano_acao_indicadores.
 * Suporta: várias grafias, linha de título antes do cabeçalho real, inferência por palavra-chave.
 */

type XlsxReadWorkbook = { SheetNames: string[]; Sheets: Record<string, unknown> }

/** Escolhe a aba com os dados (ex.: "SQL"); evita importar "Capa" ou a primeira aba vazia por engano. */
export function pickBestWorksheetForPlanoAcao(xlsx: {
  utils: { sheet_to_json: (sheet: unknown, opts: { header: 1; defval: string }) => unknown[][] }
}, wb: XlsxReadWorkbook): string {
  const names = wb.SheetNames || []
  if (names.length <= 1) return names[0] || ''

  let bestName = names[0]
  let bestScore = -1

  for (const name of names) {
    const sh = wb.Sheets[name]
    if (!sh) continue
    const matrix = xlsx.utils.sheet_to_json(sh, { header: 1, defval: '' }) as unknown[][]
    let cells = 0
    const scanRows = Math.min(matrix.length, 400)
    for (let i = 0; i < scanRows; i++) {
      const row = matrix[i] || []
      for (const c of row) {
        if (String(c ?? '').trim()) cells++
      }
    }

    const nlow = name.trim().toLowerCase()
    let bonus = 0
    if (nlow === 'sql') bonus = 500_000
    else if (nlow.includes('sql')) bonus = 200_000
    else if (/(^dados$|^base$|^planilha$|plano|indicador|gst|acao|acoes)/i.test(nlow)) bonus = 50_000

    const score = bonus + cells
    if (score > bestScore) {
      bestScore = score
      bestName = name
    }
  }

  return bestName
}

export function normHeader(s: unknown): string {
  return String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, '')
}

/** Cabeçalhos exatos (após normHeader) → coluna SQL */
export const HEADER_TO_COL: { col: string; headerNorms: string[] }[] = [
  { col: 'item', headerNorms: ['ITEM', 'NITEM', 'NUMEROITEM', 'NUMITEM', 'CODITEM', 'CODIGODOITEM', 'CODIGOITEM', 'SEQ', 'SEQUENCIA', 'NUMERO'] },
  { col: 'empresa', headerNorms: ['EMPRESA', 'ORGAO', 'ORGAOEMPREGADOR'] },
  { col: 'unidade', headerNorms: ['UNIDADE', 'UNIDADEFUNCIONAL', 'NOMEDAUNIDADE', 'ESTABELECIMENTO', 'HOSPITAL', 'UPA', 'UNIDADESAUDE'] },
  { col: 'diretoria', headerNorms: ['DIRETORIA', 'DIR', 'SUPERINTENDENCIA'] },
  {
    col: 'gerencia',
    headerNorms: ['GERENCIA', 'GERÊNCIA', 'GERENCIAS', 'COORDENACAO', 'COORDENAÇÃO', 'SETOR', 'GERSEGURANCA', 'GERSEGURANCADOTRABALHO'],
  },
  {
    col: 'cod_origem',
    headerNorms: [
      'CODORIGEM',
      'CODIGOORIGEM',
      'CODORIGEMITEM',
      'CODORIG',
      'CODIGO',
      'CODORIGEMDESCRICAO',
    ],
  },
  { col: 'data_origem', headerNorms: ['DATADEORIGEM', 'DATAORIGEM', 'DATA DE ORIGEM', 'DTORIGEM', 'DATAORIG'] },
  { col: 'origem', headerNorms: ['ORIGEM', 'FONTE', 'TIPOORIGEM'] },
  { col: 'indicador', headerNorms: ['INDICADOR', 'INDICADORES', 'NOMEINDICADOR'] },
  { col: 'auxiliar', headerNorms: ['AUXILIAR', 'INDICADORAUXILIAR', 'META'] },
  { col: 'acao', headerNorms: ['ACAO', 'AÇÃO', 'ACOES', 'AÇÕES', 'DESCRICAOACAO', 'PLANOACAO', 'OQUEFAZER'] },
  {
    col: 'regional',
    headerNorms: [
      'REGIONAL',
      'MACROREGIONAL',
      'MACRO REGIONAL',
      'REGIAO',
      'REGIÃO',
      'REGIAODESAUDE',
      'RS',
      'COORDENACAOREGIONAL',
      'SUPERINTENDENCIAREGIONAL',
    ],
  },
  { col: 'responsavel', headerNorms: ['RESPONSAVEL', 'RESPONSÁVEL', 'RESPONSAVEIS', 'EXECUTOR', 'FUINCIONARIORSPONSAVEL', 'FUNCIONARIORSPONSAVEL'] },
  { col: 'prazo', headerNorms: ['PRAZO', 'DATAPR', 'DATA PRAZO', 'VENCIMENTO', 'DT PRAZO', 'PRAZOENTREGA'] },
  {
    col: 'conclusao',
    headerNorms: ['CONCLUSAO', 'CONCLUSÃO', 'DATA CONCLUSAO', 'DTCONCLUSAO', 'DATA DE CONCLUSAO', 'DATACONCLUSAO'],
  },
  { col: 'novo_prazo', headerNorms: ['NOVOPRAZO', 'NOVO PRAZO', 'PRAZOREAGENDADO', 'DATANOVA', 'REAGENDAMENTO'] },
  { col: 'status', headerNorms: ['STATUS', 'SITUACAO', 'SITUAÇÃO', 'ANDAMENTO', 'FASE'] },
  { col: 'evidencia', headerNorms: ['EVIDENCIA', 'EVIDÊNCIA', 'COMPROVANTE', 'ANEXO', 'LINK'] },
  { col: 'comentarios', headerNorms: ['COMENTARIOS', 'COMENTÁRIOS', 'OBSERVACOES', 'OBSERVAÇÕES', 'OBS', 'PARECER'] },
  { col: 'origem_ano', headerNorms: ['ORIGEMANO', 'ORIGEM ANO', 'ANOORIGEM', 'ANO ORIGEM'] },
  { col: 'origem_mes', headerNorms: ['ORIGEMMES', 'ORIGEM MES', 'ORIGEM MÊS', 'MESORIGEM'] },
  { col: 'mes_prazo', headerNorms: ['MESPRAZO', 'MÊS PRAZO', 'MES PRAZO', 'ANOMESPRAZO'] },
]

export function resolveFileHeaderToCol(fileHeaders: string[]): Map<string, string> {
  const normToRaw = new Map<string, string>()
  for (const h of fileHeaders) {
    const raw = String(h ?? '').trim()
    if (!raw) continue
    const n = normHeader(raw)
    if (n && !normToRaw.has(n)) normToRaw.set(n, raw)
  }
  const colToFile = new Map<string, string>()
  for (const { col, headerNorms } of HEADER_TO_COL) {
    for (const hn of headerNorms) {
      const key = normHeader(hn)
      const raw = normToRaw.get(key)
      if (raw) {
        colToFile.set(col, raw)
        break
      }
    }
  }
  return colToFile
}

/** Preenche colunas ainda sem mapeamento, pela forma do título da coluna. */
export function applyFuzzyColumnMappings(colToFile: Map<string, string>, headerKeysInOrder: string[]) {
  const used = new Set<string>(colToFile.values())
  const trySet = (col: string, rawKey: string) => {
    if (colToFile.has(col)) return false
    if (!rawKey || rawKey.startsWith('__col_')) return false
    if (used.has(rawKey)) return false
    colToFile.set(col, rawKey)
    used.add(rawKey)
    return true
  }

  for (const rawKey of headerKeysInOrder) {
    if (rawKey.startsWith('__col_')) continue
    if (used.has(rawKey)) continue
    const n = normHeader(rawKey)
    if (!n || n === 'NULO') continue

    if (/NOVOPRAZO|NOVOPRA|PRAZONOVO|REAGEND|DATANOVO|NOVADATA/.test(n)) {
      trySet('novo_prazo', rawKey)
      continue
    }
    if (/CONCLUS/.test(n)) {
      trySet('conclusao', rawKey)
      continue
    }
    if (/MACROREGIONAL|MACROREG|REGIONAL|REGIAO|REGIAODESAUDE|COORDREGIONAL|SUPERINTREGIONAL/.test(n)) {
      trySet('regional', rawKey)
      continue
    }
    if (/RESPONSAVEL|RESPONSV|EXECUTOR|FUINCIONARIO|FUNCIONARIO/.test(n)) {
      trySet('responsavel', rawKey)
      continue
    }
    if (/INDICAD/.test(n) && !/AUXILIAR/.test(n)) {
      trySet('indicador', rawKey)
      continue
    }
    if (/MESPRAZO|ANOMESPRAZO/.test(n)) {
      trySet('mes_prazo', rawKey)
      continue
    }
    if (/ORIGEMMES/.test(n) || (n.includes('ORIGEM') && n.includes('MES') && !n.includes('ANO'))) {
      trySet('origem_mes', rawKey)
      continue
    }
    if (/ORIGEMANO|ANOORIGEM/.test(n) || (n.includes('ORIGEM') && n.includes('ANO'))) {
      trySet('origem_ano', rawKey)
      continue
    }
    if (/DATADEORIGEM|DATAORIGEM|DTORIGEM/.test(n)) {
      trySet('data_origem', rawKey)
      continue
    }
    if (/CODORIGEM|CODIGOORIGEM|CODORIG/.test(n)) {
      trySet('cod_origem', rawKey)
      continue
    }
    if (/STATUS|SITUAC/.test(n)) {
      trySet('status', rawKey)
      continue
    }
    if (/PRAZO|DATAPR|VENCIMENTO/.test(n) && !/NOVO|CONCLUS/.test(n)) {
      trySet('prazo', rawKey)
      continue
    }
    if (/EVID|COMPROVANTE|ANEXO|LINK/.test(n)) {
      trySet('evidencia', rawKey)
      continue
    }
    if (/COMENT|OBSERV|PARECER/.test(n)) {
      trySet('comentarios', rawKey)
      continue
    }
    if (/AUXILIAR/.test(n)) {
      trySet('auxiliar', rawKey)
      continue
    }
    if (/ACAO|ACOES|PLANOACAO/.test(n)) {
      trySet('acao', rawKey)
      continue
    }
    if (/DIRETOR/.test(n)) {
      trySet('diretoria', rawKey)
      continue
    }
    if (/GEREN|COORDEN/.test(n) && !/REGIONAL/.test(n)) {
      trySet('gerencia', rawKey)
      continue
    }
    if (/EMPRESA|ORGAO|ORGANIZ/.test(n)) {
      trySet('empresa', rawKey)
      continue
    }
    if (/UNIDADE|HOSPITAL|UPA|ESTABELEC|UNIDFUNC/.test(n)) {
      trySet('unidade', rawKey)
      continue
    }
    if (/ORIGEM/.test(n) && !/ANO|MES|DATA|COD/.test(n)) {
      trySet('origem', rawKey)
      continue
    }
    if (/^ITEM$|^NUMERO$|^NUM$|^SEQ|^COD$/.test(n) || (n.includes('ITEM') && n.length <= 28)) {
      trySet('item', rawKey)
      continue
    }
  }
}

export function scoreColumnMap(colToFile: Map<string, string>): number {
  let s = colToFile.size * 4
  if (colToFile.has('item')) s += 6
  if (colToFile.has('regional')) s += 5
  if (colToFile.has('prazo')) s += 5
  if (colToFile.has('status')) s += 5
  if (colToFile.has('acao') || colToFile.has('indicador')) s += 4
  if (colToFile.has('responsavel')) s += 3
  return s
}

/** Converte matriz da planilha (header:1) em linhas objeto + melhor linha de cabeçalho. */
export function matrixToDataRows(matrix: unknown[][]): {
  rawRows: Record<string, unknown>[]
  headerRowIndex: number
  headerKeys: string[]
  colToFile: Map<string, string>
} {
  if (!matrix.length) {
    return { rawRows: [], headerRowIndex: 0, headerKeys: [], colToFile: new Map() }
  }

  const maxScan = Math.min(30, matrix.length)
  let bestIdx = 0
  let bestScore = -1
  let bestMap = new Map<string, string>()
  let bestKeys: string[] = []

  for (let i = 0; i < maxScan; i++) {
    const row = matrix[i] || []
    const headerKeys: string[] = []
    const nonEmptyLabels: string[] = []
    const width = Math.max(row.length, ...matrix.slice(i, i + 15).map((r) => (r || []).length))
    for (let j = 0; j < width; j++) {
      const cell = String((row as unknown[])[j] ?? '').trim()
      const key = cell || `__col_${j}`
      headerKeys.push(key)
      if (cell && cell.toUpperCase() !== 'NULO') nonEmptyLabels.push(cell)
    }

    const colToFile = resolveFileHeaderToCol(nonEmptyLabels.length ? nonEmptyLabels : headerKeys.filter((k) => !k.startsWith('__col_')))
    applyFuzzyColumnMappings(colToFile, headerKeys)

    const sc = scoreColumnMap(colToFile)
    if (sc > bestScore) {
      bestScore = sc
      bestIdx = i
      bestMap = colToFile
      bestKeys = headerKeys
    }
  }

  const rawRows: Record<string, unknown>[] = []
  for (let r = bestIdx + 1; r < matrix.length; r++) {
    const dataRow = matrix[r] || []
    const obj: Record<string, unknown> = {}
    for (let j = 0; j < bestKeys.length; j++) {
      const hk = bestKeys[j]
      obj[hk] = (dataRow as unknown[])[j]
    }
    const hasData = Object.values(obj).some((v) => {
      if (v === null || v === undefined) return false
      const t = String(v).trim()
      return t !== '' && t.toUpperCase() !== 'NULO'
    })
    if (hasData) rawRows.push(obj)
  }

  return { rawRows, headerRowIndex: bestIdx, headerKeys: bestKeys, colToFile: bestMap }
}

export function mappingSummary(colToFile: Map<string, string>): { col: string; header: string }[] {
  return Array.from(colToFile.entries())
    .map(([col, header]) => ({ col, header }))
    .sort((a, b) => a.col.localeCompare(b.col))
}
