
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function esc(s: string){ return s.replace(/'/g, "''"); }

export async function GET(req: Request) {
  try{
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
    const q = (searchParams.get('q') || '').trim();
    const offset = (page - 1) * limit;

    const like = `%${esc(q)}%`;
    const qnum = q.replace(/\D/g, '');

    const where = q ? `AND (
        (r.data->>'Colaborador') ILIKE '${like}'
        OR regexp_replace(COALESCE(r.data->>'CPF',''),'[^0-9]','','g') LIKE '${qnum}'
        OR (r.data->>'Matrícula') ILIKE '${like}'
        OR (r.data->>'Unidade Hospitalar') ILIKE '${like}'
        OR (r.data->>'Função') ILIKE '${like}'
      )` : '';

    const sql = `
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT row_no, data
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ${where}
      ORDER BY row_no
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
