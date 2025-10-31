import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const url = process.env.DATABASE_URL
    if (!url) {
      return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 500 })
    }
    const sql = neon(url)
    const [c1] = await sql`SELECT COUNT(1)::int AS c FROM stg_alterdata`
    const [c2] = await sql`SELECT COUNT(1)::int AS c FROM stg_unid_reg`
    let c3 = 0
    try {
      const [r] = await sql`SELECT COUNT(1)::int AS c FROM colaborador`
      c3 = r?.c ?? 0
    } catch (e) {
      // ignore if table not present
      c3 = 0
    }
    return NextResponse.json({ ok: true, counts: { colaborador: c3, stg_alterdata: c1?.c ?? 0, stg_unid_reg: c2?.c ?? 0 } })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}