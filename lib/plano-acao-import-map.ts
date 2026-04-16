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
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
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
  { col: 'diretoria', headerNorms: ['DIRETORIA', 'SUPERINTENDENCIA'] },
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

/**
 * Ordem típica da planilha GST (A..V): mescla com o Excel que vocês usam.
 * Usado só para preencher colunas que ainda faltaram após match por nome.
 */
export const GST_COLUMN_ORDER: string[] = [
  'item',
  'empresa',
  'unidade',
  'diretoria',
  'gerencia',
  'cod_origem',
  'data_origem',
  'origem',
  'indicador',
  'auxiliar',
  'acao',
  'regional',
  'responsavel',
  'prazo',
  'conclusao',
  'novo_prazo',
  'status',
  'evidencia',
  'comentarios',
  'origem_ano',
  'origem_mes',
  'mes_prazo',
]

/** Resolve cabeçalho → coluna sem “sumir” títulos duplicados no mapa (cada célula só pode ir para uma coluna SQL). */
export function resolveFileHeaderToCol(fileHeaders: string[]): Map<string, string> {
  const entries = fileHeaders
    .map((h) => String(h ?? '').trim())
    .filter((h) => h && h.toUpperCase() !== 'NULO')
    .map((raw) => ({ raw, n: normHeader(raw) }))

  const used = new Set<string>()
  const colToFile = new Map<string, string>()

  for (const { col, headerNorms } of HEADER_TO_COL) {
    const normKeys = new Set(headerNorms.map((hn) => normHeader(hn)))
    for (const { raw, n } of entries) {
      if (used.has(raw)) continue
      if (normKeys.has(n)) {
        colToFile.set(col, raw)
        used.add(raw)
        break
      }
    }
  }
  return colToFile
}

/**
 * Garante mapeamento A..V (22 colunas) do Excel GST.
 * - Cabeçalhos vazios viram __col_J nas linhas de dados; aqui também ligamos essas chaves ao campo SQL certo.
 * - Se o match por nome veio fraco (<12), assume ordem fixa A..V (planilha padrão de vocês).
 */
export function ensureGstColumnMapping(colToFile: Map<string, string>, headerKeys: string[]) {
  const w = Math.min(GST_COLUMN_ORDER.length, headerKeys.length)
  if (w < 18) return

  if (colToFile.size < 12) {
    for (let j = 0; j < w; j++) {
      colToFile.set(GST_COLUMN_ORDER[j], headerKeys[j])
    }
    return
  }

  for (let j = 0; j < w; j++) {
    const sql = GST_COLUMN_ORDER[j]
    if (!colToFile.has(sql)) colToFile.set(sql, headerKeys[j])
  }
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

/** Copia valor da célula âncora para células vazias na mesma linha (mesclas horizontais do cabeçalho). */
export function applyHorizontalMergeFill(
  matrix: unknown[][],
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] | undefined,
  maxRow: number,
): unknown[][] {
  const m = matrix.map((r) => [...(r || [])])
  if (!merges?.length) return m
  for (const { s, e } of merges) {
    if (s.r !== e.r || s.r > maxRow) continue
    const row = m[s.r]
    if (!row) continue
    const anchor = row[s.c]
    const anchorStr = String(anchor ?? '').trim()
    if (!anchorStr) continue
    for (let c = s.c; c <= e.c; c++) {
      const cur = String(row[c] ?? '').trim()
      if (!cur) row[c] = anchor
    }
  }
  return m
}

/** Corta linhas em branco no fim (faixa do Excel costuma ir além dos dados). */
export function trimMatrixUsedRange(matrix: unknown[][]): unknown[][] {
  let last = matrix.length - 1
  while (last >= 0) {
    const row = matrix[last] || []
    const any = row.some((c) => {
      const t = String(c ?? '').trim()
      return t !== '' && t.toUpperCase() !== 'NULO'
    })
    if (any) break
    last--
  }
  if (last < 0) return []
  return matrix.slice(0, last + 1)
}

/** Remove linhas que não têm conteúdo “de negócio” (evita milhares de linhas só com 0 ou vazio). */
export function filterMeaningfulPlanoRows(
  rawRows: Record<string, unknown>[],
  colToFile: Map<string, string>,
): Record<string, unknown>[] {
  const key = (col: string) => colToFile.get(col) || ''
  const read = (row: Record<string, unknown>, col: string) => {
    const k = key(col)
    if (!k) return ''
    return String(row[k] ?? '').trim()
  }

  return rawRows.filter((row) => {
    const parts = [
      read(row, 'item'),
      read(row, 'empresa'),
      read(row, 'unidade'),
      read(row, 'indicador'),
      read(row, 'acao'),
      read(row, 'regional'),
      read(row, 'status'),
      read(row, 'prazo'),
      read(row, 'responsavel'),
      read(row, 'origem'),
      read(row, 'cod_origem'),
      read(row, 'evidencia'),
      read(row, 'comentarios'),
    ].filter((t) => t && t.toUpperCase() !== 'NULO')
    if (parts.length === 0) return false
    const joined = parts.join(' ')
    const hasLetter = /[A-Za-zÀ-ÿ]/.test(joined)
    const hasDigit = /\d/.test(joined)
    if (!hasLetter && !hasDigit) return false
    return true
  })
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
  let bestHeaderLabelCount = -1
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

    const labelsForResolve =
      nonEmptyLabels.length >= 3 ? nonEmptyLabels : headerKeys.filter((k) => !k.startsWith('__col_'))
    const colToFile = resolveFileHeaderToCol(labelsForResolve)
    applyFuzzyColumnMappings(colToFile, headerKeys)

    const headerLabelCount = headerKeys.filter((k) => k && !String(k).startsWith('__col_')).length
    const sc = scoreColumnMap(colToFile) + headerLabelCount * 5 + colToFile.size * 2
    const better =
      sc > bestScore ||
      (sc === bestScore && headerLabelCount > bestHeaderLabelCount) ||
      (sc === bestScore && headerLabelCount === bestHeaderLabelCount && colToFile.size > bestMap.size)
    if (better) {
      bestScore = sc
      bestHeaderLabelCount = headerLabelCount
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

  ensureGstColumnMapping(bestMap, bestKeys)
  const filtered = filterMeaningfulPlanoRows(rawRows, bestMap)

  return { rawRows: filtered, headerRowIndex: bestIdx, headerKeys: bestKeys, colToFile: bestMap }
}

export function mappingSummary(colToFile: Map<string, string>): { col: string; header: string }[] {
  return Array.from(colToFile.entries())
    .map(([col, header]) => ({ col, header }))
    .sort((a, b) => a.col.localeCompare(b.col))
}
