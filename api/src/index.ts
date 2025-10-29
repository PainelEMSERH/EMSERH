import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { neon } from '@neondatabase/serverless'
import { verifyToken } from '@clerk/backend'
import { z } from 'zod'

const sql = neon(process.env.DATABASE_URL as string)

async function query(q: string, params: any[] = []) {
  // @ts-ignore
  return await sql(q, params)
}

async function auth(c: any, next: any) {
  const authHeader = c.req.header('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const res = await verifyToken(token, {
      issuer: process.env.CLERK_JWT_ISSUER,
      jwtKey: process.env.CLERK_SECRET_KEY,
      audience: process.env.CLERK_JWT_AUDIENCE
    })
    c.set('auth', {
      sub: res.sub,
      role: (res as any).role,
      regional_ids: (res as any).regional_ids || [],
      unidade_ids: (res as any).unidade_ids || []
    })
    await next()
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401)
  }
}

const app = new Hono()
app.use('*', cors())
app.use('*', auth)

app.get('/me', (c) => c.json({ ok: true, auth: c.get('auth') }))

// Regionais
app.get('/regionais', async (c) => {
  const rows = await query('SELECT id, nome FROM regional ORDER BY nome')
  return c.json(rows)
})
const regionalSchema = z.object({ nome: z.string().min(3) })
app.post('/regionais', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'super_admin' && a.role !== 'sesmt') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const { nome } = regionalSchema.parse(body)
  await query('INSERT INTO regional (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING', [nome])
  return c.json({ ok: true })
})

// Unidades
app.get('/unidades', async (c) => {
  const regional_id = c.req.query('regional_id')
  const rows = regional_id
    ? await query('SELECT id, regional_id, nome, cnpj, codigo FROM unidade WHERE regional_id = $1 ORDER BY nome', [regional_id])
    : await query('SELECT id, regional_id, nome, cnpj, codigo FROM unidade ORDER BY nome')
  return c.json(rows)
})
const unidadeSchema = z.object({ regional_id: z.coerce.number(), nome: z.string().min(2), cnpj: z.string().optional(), codigo: z.string().optional() })
app.post('/unidades', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'super_admin' && a.role !== 'admin_regional') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const u = unidadeSchema.parse(body)
  await query('INSERT INTO unidade (regional_id, nome, cnpj, codigo) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [u.regional_id, u.nome, u.cnpj || null, u.codigo || null])
  return c.json({ ok: true })
})

// Funções
app.get('/funcoes', async (c) => {
  const rows = await query('SELECT id, nome, descricao FROM funcao ORDER BY nome')
  return c.json(rows)
})
const funcaoSchema = z.object({ nome: z.string().min(2), descricao: z.string().optional() })
app.post('/funcoes', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'super_admin' && a.role !== 'admin_regional') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const f = funcaoSchema.parse(body)
  await query('INSERT INTO funcao (nome, descricao) VALUES ($1,$2) ON CONFLICT (nome) DO NOTHING', [f.nome, f.descricao || null])
  return c.json({ ok: true })
})

// EPIs
app.get('/epis', async (c) => {
  const rows = await query('SELECT id, nome, categoria, ca_numero, fabricante, tamanho_padrao, vida_util_meses FROM epi_item ORDER BY nome')
  return c.json(rows)
})
const epiSchema = z.object({ nome: z.string().min(2), categoria: z.string().optional(), ca_numero: z.string().optional(), fabricante: z.string().optional(), tamanho_padrao: z.string().optional(), vida_util_meses: z.coerce.number().optional() })
app.post('/epis', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'super_admin' && a.role !== 'admin_regional') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const e = epiSchema.parse(body)
  await query('INSERT INTO epi_item (nome, categoria, ca_numero, fabricante, tamanho_padrao, vida_util_meses) VALUES ($1,$2,$3,$4,$5,$6)',
    [e.nome, e.categoria || null, e.ca_numero || null, e.fabricante || null, e.tamanho_padrao || null, e.vida_util_meses || null])
  return c.json({ ok: true })
})

// Kits
app.get('/kits', async (c) => {
  const rows = await query('SELECT kf.id, kf.funcao_id, kf.nome FROM kit_funcao kf ORDER BY kf.id DESC')
  return c.json(rows)
})
const kitSchema = z.object({ funcao_id: z.coerce.number(), nome: z.string().min(2) })
app.post('/kits', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'super_admin' && a.role !== 'admin_regional') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const k = kitSchema.parse(body)
  await query('INSERT INTO kit_funcao (funcao_id, nome) VALUES ($1,$2)', [k.funcao_id, k.nome])
  return c.json({ ok: true })
})
app.get('/kits/:id/itens', async (c) => {
  const id = Number(c.req.param('id'))
  const rows = await query('SELECT ki.id, ki.kit_funcao_id, ki.epi_item_id, ki.quantidade, ei.nome as epi_nome FROM kit_item ki JOIN epi_item ei ON ei.id = ki.epi_item_id WHERE kit_funcao_id = $1', [id])
  return c.json(rows)
})
const kitItemSchema = z.object({ epi_item_id: z.coerce.number(), quantidade: z.coerce.number().min(1) })
app.post('/kits/:id/itens', async (c) => {
  const a = c.get('auth')
  if (a.role !== 'super_admin' && a.role !== 'admin_regional') return c.json({ error: 'Forbidden' }, 403)
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const i = kitItemSchema.parse(body)
  await query('INSERT INTO kit_item (kit_funcao_id, epi_item_id, quantidade) VALUES ($1,$2,$3)', [id, i.epi_item_id, i.quantidade])
  return c.json({ ok: true })
})

// Colaboradores
app.get('/colaboradores', async (c) => {
  const q = c.req.query('q') || ''
  let rows
  if (q) {
    rows = await query('SELECT id, cpf, nome, matricula, funcao_id, unidade_id, status FROM colaborador WHERE nome ILIKE $1 OR cpf ILIKE $1 ORDER BY nome LIMIT 100', ['%' + q + '%'])
  } else {
    rows = await query('SELECT id, cpf, nome, matricula, funcao_id, unidade_id, status FROM colaborador ORDER BY id DESC LIMIT 100')
  }
  return c.json(rows)
})
const colabSchema = z.object({ cpf: z.string().min(8), nome: z.string().min(3), funcao_id: z.coerce.number().nullable().optional(), unidade_id: z.coerce.number().nullable().optional() })
app.post('/colaboradores', async (c) => {
  const a = c.get('auth')
  if (!['super_admin', 'admin_regional', 'operador_unidade'].includes(a.role)) return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const col = colabSchema.parse(body)
  await query('INSERT INTO colaborador (cpf, nome, funcao_id, unidade_id, origem_dados) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (cpf) DO NOTHING',
    [col.cpf, col.nome, col.funcao_id || null, col.unidade_id || null, 'manual'])
  return c.json({ ok: true })
})

// 404
app.all('*', (c) => c.json({ error: 'Not Found' }, 404))

export default app
