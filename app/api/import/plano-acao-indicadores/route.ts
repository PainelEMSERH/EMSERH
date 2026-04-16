export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth, currentUser } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import {
  matrixToDataRows,
  mappingSummary,
  resolveFileHeaderToCol,
  applyFuzzyColumnMappings,
  pickBestWorksheetForPlanoAcao,
  applyHorizontalMergeFill,
  trimMatrixUsedRange,
} from '@/lib/plano-acao-import-map'
import { ensurePlanoAcaoIndicadoresTable } from '@/lib/plano-acao-indicadores-ensure'

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
    await ensurePlanoAcaoIndicadoresTable(prisma)

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

    let headerRowIndex = 0
    let colToFile = new Map<string, string>()

    let sheetUsed = ''

    if (isXlsx) {
      const xlsx = await import('xlsx')
      const wb = xlsx.read(buf, { type: 'buffer' })
      sheetUsed = pickBestWorksheetForPlanoAcao(xlsx, wb as { SheetNames: string[]; Sheets: Record<string, unknown> })
      const sheet = wb.Sheets[sheetUsed] || wb.Sheets[wb.SheetNames[0]]
      let matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
      const ref = (sheet as { '!ref'?: string })['!ref']
      if (ref) {
        try {
          const rng = xlsx.utils.decode_range(ref)
          matrix = matrix.slice(0, Math.min(matrix.length, rng.e.r + 1))
        } catch {
          /* ignore bad ref */
        }
      }
      matrix = trimMatrixUsedRange(matrix)
      const merges = (sheet as { '!merges'?: { s: { r: number; c: number }; e: { r: number; c: number } }[] })['!merges']
      matrix = applyHorizontalMergeFill(matrix, merges, 29)
      const parsed = matrixToDataRows(matrix)
      rawRows = parsed.rawRows
      headerRowIndex = parsed.headerRowIndex
      colToFile = parsed.colToFile
      fileHeaders = parsed.headerKeys.filter((k) => !k.startsWith('__col_'))
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

    if (!isXlsx) {
      colToFile = resolveFileHeaderToCol(fileHeaders)
      applyFuzzyColumnMappings(colToFile, fileHeaders)
    }

    if (colToFile.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Não foi possível reconhecer colunas. Coloque uma linha de cabeçalho com títulos como: Item, Regional, Prazo, Status, Responsável, Indicador, Ação, Unidade, etc. (linhas de título acima do cabeçalho são detectadas automaticamente no .xlsx).',
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
      sheet_used: sheetUsed || undefined,
      header_row_1based: isXlsx ? headerRowIndex + 1 : 1,
      column_mapping: mappingSummary(colToFile),
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
