import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function esc(s: string){ return (s||'').replace(/'/g, "''"); }
function norm(expr: string){
  return `regexp_replace(upper(${expr}), '[^A-Z0-9]', '', 'g')`;
}

async function tableExists(name: string): Promise<boolean> {
  const r: any[] = await prisma.$queryRawUnsafe(`SELECT to_regclass('${name}') as r`);
  return !!r?.[0]?.r;
}

async function latestBatchId(): Promise<string | null> {
  const hasImports = await tableExists('stg_alterdata_v2_imports');
  if (hasImports) {
    const r: any[] = await prisma.$queryRawUnsafe(`SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1`);
    return r?.[0]?.batch_id ?? null;
  }
  const hasRaw = await tableExists('stg_alterdata_v2_raw');
  if (hasRaw) {
    const r: any[] = await prisma.$queryRawUnsafe(`SELECT batch_id FROM stg_alterdata_v2_raw WHERE batch_id IS NOT NULL ORDER BY batch_id DESC LIMIT 1`);
    return r?.[0]?.batch_id ?? null;
  }
  return null;
}

export async function GET(req: Request) {
  try{
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
    const limit  = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
    const q      = (searchParams.get('q')        || '').trim();
    const regional = (searchParams.get('regional') || '').trim();
    const unidade  = (searchParams.get('unidade')  || '').trim();
    const status   = (searchParams.get('status')   || '').trim();

    const offset = (page - 1) * limit;

    const hasV2Raw = await tableExists('stg_alterdata_v2_raw');
    const hasLegacy = await tableExists('stg_alterdata');
    const hasUnidReg = await tableExists('stg_unid_reg');

    if (!hasV2Raw && !hasLegacy) {
      return NextResponse.json({ ok:false, error: 'Nenhuma tabela Alterdata encontrada (stg_alterdata_v2_raw ou stg_alterdata).' }, { status: 500 });
    }

    const wh: string[] = [];

    // Busca livre
    if(q){
      const nq = esc(q);
      wh.push(`EXISTS (
        SELECT 1 FROM jsonb_each_text(data) kv
        WHERE ${norm('kv.value')} LIKE ${norm(`'%${nq}%'`)}
      )`);
    }

    // Unidade
    if(unidade){
      wh.push(`EXISTS (
        SELECT 1 FROM jsonb_each_text(data) kv_un
        WHERE ${norm('kv_un.value')} = ${norm(`'${esc(unidade)}'`)}
      )`);
    }

    // Regional (JOIN genérico — sem dependência de nome de coluna)
    if(regional){
      if(!hasUnidReg){
        return NextResponse.json({ ok:false, error: 'Filtro de Regional exige a tabela stg_unid_reg (não encontrada).' }, { status: 500 });
      }
      wh.push(`EXISTS (
        SELECT 1
        FROM stg_unid_reg ur
        CROSS JOIN LATERAL (
          SELECT kv.value AS unidade_map
          FROM jsonb_each_text(to_jsonb(ur)) kv
          WHERE upper(kv.key) LIKE '%UNID%'
             OR upper(kv.key) LIKE '%DEPART%'
             OR upper(kv.key) LIKE '%HOSP%'
          ORDER BY
            CASE
              WHEN upper(kv.key) LIKE '%UNID%' THEN 3
              WHEN upper(kv.key) LIKE '%DEPART%' THEN 2
              WHEN upper(kv.key) LIKE '%HOSP%' THEN 1
              ELSE 0
            END DESC
          LIMIT 1
        ) u
        CROSS JOIN LATERAL (
          SELECT kv.value AS regional_map
          FROM jsonb_each_text(to_jsonb(ur)) kv
          WHERE upper(kv.key) LIKE '%REGIONAL%'
             OR upper(kv.key) LIKE '%RESPONS%'
          ORDER BY
            CASE
              WHEN upper(kv.key) LIKE '%REGIONAL_RES%' THEN 3
              WHEN upper(kv.key) LIKE '%REGIONAL%' THEN 2
              WHEN upper(kv.key) LIKE '%RESPONS%' THEN 1
              ELSE 0
            END DESC
          LIMIT 1
        ) rg
        WHERE ${norm('rg.regional_map')} = ${norm(`'${esc(regional)}'`)}
          AND EXISTS (
            SELECT 1 FROM jsonb_each_text(data) rv
            WHERE ${norm('rv.value')} = ${norm('u.unidade_map')}
          )
      )`);
    }

    // Situação
    if(status === 'Demitido'){
      wh.push(`(
        (data ? 'Demissão' AND (substring(data->>'Demissão' from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'))
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE (upper(kv.key) LIKE '%STATUS%' OR upper(kv.key) LIKE '%SITUA%')
            AND upper(kv.value) LIKE '%DEMIT%'
        )
      )`);
    }else if(status === 'Admitido'){
      wh.push(`NOT (
        (data ? 'Demissão' AND (substring(data->>'Demissão' from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'))
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE (upper(kv.key) LIKE '%STATUS%' OR upper(kv.key) LIKE '%SITUA%')
            AND upper(kv.value) LIKE '%DEMIT%'
        )
      )`);
    }else if(status === 'Afastado'){
      wh.push(`(
        EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE upper(kv.key) LIKE '%INICIO%' AND upper(kv.key) LIKE '%AFAST%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE upper(kv.key) LIKE '%FIM%' AND upper(kv.key) LIKE '%AFAST%'
            AND (substring(kv.value from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
            AND to_date(substring(kv.value from 1 for 10), 'YYYY-MM-DD') < current_date
        )
      )`);
    }

    const where = wh.length ? ('WHERE ' + wh.join(' AND ')) : '';

    let rowsSql = '';
    let countSql = '';

    if (hasV2Raw) {
      const batchId = await latestBatchId();
      const batchWhere = batchId ? `WHERE r.batch_id = '${esc(batchId)}'` : '';
      const andOrWhere = where ? (batchWhere ? `${batchWhere} AND ${where.replace(/^WHERE\s+/, '')}` : where) : batchWhere;

      rowsSql = `
        SELECT r.row_no, r.data
        FROM stg_alterdata_v2_raw r
        ${andOrWhere}
        ORDER BY r.row_no
        LIMIT ${limit} OFFSET ${offset}
      `;

      countSql = `
        SELECT COUNT(*)::int AS total
        FROM stg_alterdata_v2_raw r
        ${andOrWhere}
      `;
    } else {
      const base = `SELECT row_number() over() as row_no, to_jsonb(t) as data FROM stg_alterdata t`;
      const baseAlias = 'base';

      rowsSql = `
        WITH ${baseAlias} AS (${base})
        SELECT row_no, data
        FROM ${baseAlias}
        ${where}
        ORDER BY row_no
        LIMIT ${limit} OFFSET ${offset}
      `;

      countSql = `
        WITH ${baseAlias} AS (${base})
        SELECT COUNT(*)::int AS total
        FROM ${baseAlias}
        ${where}
      `;
    }

    const [rows, totalRes] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql),
      prisma.$queryRawUnsafe<any[]>(countSql),
    ]);

    const total = totalRes?.[0]?.total ?? 0;
    const res = NextResponse.json({ ok:true, rows, page, limit, total });
    res.headers.set('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
