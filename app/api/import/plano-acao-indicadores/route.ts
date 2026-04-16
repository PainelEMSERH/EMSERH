export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth, currentUser } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br'

async function ensureAdmin() {
  const { userId } = await auth()
  if (!userId) return { ok: false as const, status: 401 }
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ''
  if (!email) return { ok: false as const, status: 403 }
  if (email === ROOT_ADMIN_EMAIL) return { ok: true as const, email }
  try {
    const dbUser = await prisma.usuario.findUnique({ where: { email } })
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) return { ok: true as const, email }
  } catch {
    /* ignore */
  }
  return { ok: false as const, status: 403 }
}

function normHeader(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, '')
}

function escSql(s: string): string {
  return s.replace(/'/g, "''")
}

function sqlText(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  if (!t) return 'NULL'
  return `'${escSql(t)}'`
}

function sqlDate(v: Date | null): string {
  if (!v || Number.isNaN(v.getTime())) return 'NULL'
  return `'${v.toISOString().slice(0, 10)}'::date`
}

function sqlInt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return 'NULL'
  return String(Math.trunc(v))
}

function parseDateCell(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  const s = String(raw).trim()
  if (!s) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const excel = Number(s)
  if (Number.isFinite(excel) && excel > 20000) {
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + excel * 86400000)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function parseIntCell(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  const s = String(raw).trim().replace(/\./g, '').replace(',', '.')
  if (!s) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

/** Mapeia cabeçalho da planilha (após normHeader) -> coluna SQL */
const HEADER_TO_COL: { col: string; headerNorms: string[] }[] = [
  { col: 'item', headerNorms: ['ITEM'] },
  { col: 'empresa', headerNorms: ['EMPRESA'] },
  { col: 'unidade', headerNorms: ['UNIDADE'] },
  { col: 'diretoria', headerNorms: ['DIRETORIA'] },
  { col: 'gerencia', headerNorms: ['GERENCIA'] },
  { col: 'cod_origem', headerNorms: ['CODORIGEM', 'CODIGOORIGEM', 'CODORIGEMITEM'] },
  { col: 'data_origem', headerNorms: ['DATADEORIGEM', 'DATAORIGEM', 'DATA DE ORIGEM'] },
  { col: 'origem', headerNorms: ['ORIGEM'] },
  { col: 'indicador', headerNorms: ['INDICADOR'] },
  { col: 'auxiliar', headerNorms: ['AUXILIAR'] },
  { col: 'acao', headerNorms: ['ACAO', 'AÇÃO'] },
  { col: 'regional', headerNorms: ['REGIONAL'] },
  { col: 'responsavel', headerNorms: ['RESPONSAVEL', 'RESPONSÁVEL'] },
  { col: 'prazo', headerNorms: ['PRAZO'] },
  { col: 'conclusao', headerNorms: ['CONCLUSAO', 'CONCLUSÃO'] },
  { col: 'novo_prazo', headerNorms: ['NOVOPRAZO', 'NOVO PRAZO'] },
  { col: 'status', headerNorms: ['STATUS'] },
  { col: 'evidencia', headerNorms: ['EVIDENCIA', 'EVIDÊNCIA'] },
  { col: 'comentarios', headerNorms: ['COMENTARIOS', 'COMENTÁRIOS'] },
  { col: 'origem_ano', headerNorms: ['ORIGEMANO', 'ORIGEM ANO'] },
  { col: 'origem_mes', headerNorms: ['ORIGEMMES', 'ORIGEM MES', 'ORIGEM MÊS'] },
  { col: 'mes_prazo', headerNorms: ['MESPRAZO', 'MÊS PRAZO', 'MES PRAZO'] },
]

function resolveFileHeaderToCol(fileHeaders: string[]): Map<string, string> {
  const normToRaw = new Map<string, string>()
  for (const h of fileHeaders) {
    const n = normHeader(h)
    if (n && !normToRaw.has(n)) normToRaw.set(n, h)
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

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS plano_acao_indicadores (
      id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      item                  TEXT,
      empresa               TEXT,
      unidade               TEXT,
      diretoria             TEXT,
      gerencia              TEXT,
      cod_origem            TEXT,
      data_origem           DATE,
      origem                TEXT,
      indicador             TEXT,
      auxiliar              TEXT,
      acao                  TEXT,
      regional              TEXT,
      responsavel           TEXT,
      prazo                 DATE,
      conclusao             DATE,
      novo_prazo            DATE,
      status                TEXT,
      evidencia             TEXT,
      comentarios           TEXT,
      origem_ano            INTEGER,
      origem_mes            INTEGER,
      mes_prazo             INTEGER,
      arquivo_origem        TEXT,
      import_batch_id       TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_plano_acao_regional ON plano_acao_indicadores (regional);`,
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_plano_acao_status ON plano_acao_indicadores (status);`,
  )
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_plano_acao_prazo ON plano_acao_indicadores (prazo);`)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_plano_acao_origem_ano_mes ON plano_acao_indicadores (origem_ano, origem_mes);`,
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_plano_acao_import_batch ON plano_acao_indicadores (import_batch_id);`,
  )
}

export async function POST(req: Request) {
  const gate = await ensureAdmin()
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: gate.status })
  }

  try {
    await ensureTable()

    const form = await req.formData()
    const file = form.get('file') as File | null
    const replaceAll = String(form.get('replace') ?? '1') !== '0'

    if (!file) {
      return NextResponse.json({ ok: false, error: 'Envie um arquivo (.xlsx ou .csv)' }, { status: 400 })
    }

    const filename = (file.name || '').toLowerCase()
    const buf = Buffer.from(await file.arrayBuffer())
    const isXlsx = filename.endsWith('.xlsx') || filename.endsWith('.xls')
    if (!isXlsx && !filename.endsWith('.csv')) {
      return NextResponse.json({ ok: false, error: 'Formato inválido. Use .xlsx ou .csv' }, { status: 400 })
    }

    let rawRows: Record<string, unknown>[] = []
    let fileHeaders: string[] = []

    if (isXlsx) {
      const xlsx = await import('xlsx')
      const wb = xlsx.read(buf, { type: 'buffer' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rowsRaw = xlsx.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]
      rawRows = rowsRaw.map((r) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(r || {})) {
          out[String(k).trim()] = v
        }
        return out
      })
      fileHeaders = Array.from(new Set(rawRows.flatMap((r) => Object.keys(r || {})).map((h) => String(h).trim())))
    } else {
      const text = buf.toString('utf8').replace(/^\uFEFF/, '')
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
      if (lines.length < 2) {
        return NextResponse.json({ ok: false, error: 'CSV vazio ou sem dados' }, { status: 400 })
      }
      const sep = lines[0].includes(';') && !lines[0].split(';').every((c) => c.split(',').length > 2) ? ';' : ','
      const parseLine = (line: string) => {
        const out: string[] = []
        let cur = ''
        let q = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') {
            q = !q
            continue
          }
          if (!q && ch === sep) {
            out.push(cur)
            cur = ''
          } else cur += ch
        }
        out.push(cur)
        return out.map((c) => c.trim().replace(/^"|"$/g, ''))
      }
      fileHeaders = parseLine(lines[0])
      for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i])
        const row: Record<string, unknown> = {}
        fileHeaders.forEach((h, j) => {
          row[h] = cells[j] ?? ''
        })
        if (Object.values(row).some((v) => String(v).trim() !== '')) rawRows.push(row)
      }
    }

    const colToFile = resolveFileHeaderToCol(fileHeaders)
    if (colToFile.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Não foi possível reconhecer colunas. Use na 1ª linha os títulos: Item, Empresa, Unidade, Diretoria, Gerência, Cod. Origem, Data de origem, Origem, Indicador, Auxiliar, Ação, Regional, Responsável, Prazo, Conclusão, Novo Prazo, Status, Evidência, Comentários, ORIGEM ANO, ORIGEM MES, MÊS PRAZO.',
        },
        { status: 400 },
      )
    }

    const batchId = randomUUID()
    const escName = escSql(file.name || 'upload')

    const get = (row: Record<string, unknown>, col: string): unknown => {
      const fh = colToFile.get(col)
      return fh ? row[fh] : ''
    }

    const valuesSql: string[] = []
    for (const row of rawRows) {
      const item = String(get(row, 'item') ?? '')
      if (!item.trim() && !String(get(row, 'indicador') ?? '').trim() && !String(get(row, 'acao') ?? '').trim()) {
        continue
      }
      const dataOrigem = parseDateCell(get(row, 'data_origem'))
      const prazo = parseDateCell(get(row, 'prazo'))
      const conclusao = parseDateCell(get(row, 'conclusao'))
      const novoPrazo = parseDateCell(get(row, 'novo_prazo'))

      valuesSql.push(`(
        ${sqlText(String(get(row, 'item') ?? ''))},
        ${sqlText(String(get(row, 'empresa') ?? ''))},
        ${sqlText(String(get(row, 'unidade') ?? ''))},
        ${sqlText(String(get(row, 'diretoria') ?? ''))},
        ${sqlText(String(get(row, 'gerencia') ?? ''))},
        ${sqlText(String(get(row, 'cod_origem') ?? ''))},
        ${sqlDate(dataOrigem)},
        ${sqlText(String(get(row, 'origem') ?? ''))},
        ${sqlText(String(get(row, 'indicador') ?? ''))},
        ${sqlText(String(get(row, 'auxiliar') ?? ''))},
        ${sqlText(String(get(row, 'acao') ?? ''))},
        ${sqlText(String(get(row, 'regional') ?? ''))},
        ${sqlText(String(get(row, 'responsavel') ?? ''))},
        ${sqlDate(prazo)},
        ${sqlDate(conclusao)},
        ${sqlDate(novoPrazo)},
        ${sqlText(String(get(row, 'status') ?? ''))},
        ${sqlText(String(get(row, 'evidencia') ?? ''))},
        ${sqlText(String(get(row, 'comentarios') ?? ''))},
        ${sqlInt(parseIntCell(get(row, 'origem_ano')))},
        ${sqlInt(parseIntCell(get(row, 'origem_mes')))},
        ${sqlInt(parseIntCell(get(row, 'mes_prazo')))},
        '${escName}',
        '${batchId}'
      )`)
    }

    if (valuesSql.length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhuma linha de dados válida após o cabeçalho' }, { status: 400 })
    }

    if (replaceAll) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE plano_acao_indicadores;`)
    }

    const chunk = 80
    for (let i = 0; i < valuesSql.length; i += chunk) {
      const slice = valuesSql.slice(i, i + chunk)
      const q = `
        INSERT INTO plano_acao_indicadores (
          item, empresa, unidade, diretoria, gerencia, cod_origem, data_origem, origem,
          indicador, auxiliar, acao, regional, responsavel, prazo, conclusao, novo_prazo,
          status, evidencia, comentarios, origem_ano, origem_mes, mes_prazo,
          arquivo_origem, import_batch_id
        ) VALUES ${slice.join(',')}
      `
      await prisma.$executeRawUnsafe(q)
    }

    return NextResponse.json({
      ok: true,
      imported: valuesSql.length,
      import_batch_id: batchId,
      replace: replaceAll,
      message: replaceAll
        ? `Base substituída: ${valuesSql.length} linha(s) gravadas no Neon (tabela plano_acao_indicadores).`
        : `Inseridas ${valuesSql.length} linha(s) (sem truncar a tabela).`,
    })
  } catch (e: any) {
    console.error('[plano-acao-indicadores]', e)
    return NextResponse.json(
      { ok: false, error: String(e?.message || e || 'Erro na importação') },
      { status: 500 },
    )
  }
}
