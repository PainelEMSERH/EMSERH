import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function esc(s: string){ return (s||'').replace(/'/g, "''"); }
function norm(expr: string){
  return `regexp_replace(upper(${expr}), '[^A-Z0-9]', '', 'g')`;
}

export async function GET(req: Request) {
  try{
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
    const limit  = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
    const q      = (searchParams.get('q')        || '').trim();
    const regional = (searchParams.get('regional') || '').trim();
    const unidade  = (searchParams.get('unidade')  || '').trim();
    const status   = (searchParams.get('status')   || '').trim(); // '', 'Admitido', 'Demitido', 'Afastado'
    const offset = (page - 1) * limit;

    const wh: string[] = [];

    if(q){
      const like = `%${esc(q)}%`;
      wh.push(`r.data::text ILIKE '${like}'`);
    }

    if(regional){
      wh.push(`EXISTS (
        SELECT 1 FROM stg_unid_reg ur
        WHERE EXISTS (
          SELECT 1 FROM jsonb_each_text(r.data) kv
          WHERE ${norm('kv.value')} = ${norm('ur.nmddepartamento')}
        ) AND ur.regional_responsavel = '${esc(regional)}'
      )`);
    }

    if(unidade){
      wh.push(`EXISTS (
        SELECT 1 FROM jsonb_each_text(r.data) kv
        WHERE ${norm('kv.value')} = ${norm('\'' + esc(unidade) + '\'')}
      )`);
    }

    if(status === 'Demitido'){
      wh.push(`(
        (r.data ? 'Demissão' AND (substring(r.data->>'Demissão' from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'))
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(r.data) kv
          WHERE (upper(kv.key) LIKE '%STATUS%' OR upper(kv.key) LIKE '%SITUA%')
            AND upper(kv.value) LIKE '%DEMIT%'
        )
      )`);
    }else if(status === 'Admitido'){
      wh.push(`NOT (
        (r.data ? 'Demissão' AND (substring(r.data->>'Demissão' from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'))
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(r.data) kv
          WHERE (upper(kv.key) LIKE '%STATUS%' OR upper(kv.key) LIKE '%SITUA%')
            AND upper(kv.value) LIKE '%DEMIT%'
        )
      )`);
    }else if(status === 'Afastado'){
      wh.push(`(
        EXISTS (
          SELECT 1 FROM jsonb_each_text(r.data) kv
          WHERE upper(kv.key) LIKE '%INICIO%' AND upper(kv.key) LIKE '%AFAST%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(r.data) kv
          WHERE upper(kv.key) LIKE '%FIM%' AND upper(kv.key) LIKE '%AFAST%'
            AND (substring(kv.value from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
            AND to_date(substring(kv.value from 1 for 10), 'YYYY-MM-DD') < current_date
        )
      )`);
    }

    const where = wh.length ? ('AND ' + wh.join(' AND ')) : '';

    const sql = `
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT r.row_no, r.data
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ${where}
      ORDER BY r.row_no
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows: any[] = await prisma.$queryRawUnsafe(sql);

    const countSql = `
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ${where}
    `;
    const totalRes: any[] = await prisma.$queryRawUnsafe(countSql);
    const total = totalRes?.[0]?.total ?? 0;

    return NextResponse.json({ ok:true, rows, page, limit, total });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
