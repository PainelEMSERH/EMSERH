import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function esc(s: string){ return s.replace(/'/g, "''"); }

export async function GET(req: Request) {
  try{
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
    const q = (searchParams.get('q') || '').trim();
    const regional = (searchParams.get('regional') || '').trim();
    const unidade  = (searchParams.get('unidade')  || '').trim();
    const status   = (searchParams.get('status')   || '').trim(); // 'admitido' | 'demitido' | ''
    const offset = (page - 1) * limit;

    const like = `%${esc(q)}%`;
    const qnum = q.replace(/\D/g, '');

    const whereQ = q ? `AND (
        (r.data->>'Colaborador') ILIKE '${like}'
        OR regexp_replace(COALESCE(r.data->>'CPF',''),'[^0-9]','','g') LIKE '${qnum}'
        OR (r.data->>'Matrícula') ILIKE '${like}'
        OR (r.data->>'Unidade Hospitalar') ILIKE '${like}'
        OR (r.data->>'Função') ILIKE '${like}'
      )` : '';

    const whereRegional = regional ? `AND COALESCE(m.regional,'') = '${esc(regional)}'` : '';
    const whereUnidade  = unidade  ? `AND COALESCE(u_nome,'')   = '${esc(unidade )}'` : '';
    const whereStatus   = status   ? (
      status === 'admitido' ? `AND (demissao_txt IS NULL OR demissao_txt = '' )`
      : status === 'demitido' ? `AND (demissao_txt IS NOT NULL AND demissao_txt <> '')`
      : ''
    ) : '';

    const sql = `
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      ),
      src AS (
        SELECT
          r.row_no,
          r.data,
          r.data->>'Matrícula' AS matricula_txt,
          r.data->>'CPF' AS cpf_txt,
          r.data->>'Colaborador' AS colaborador,
          COALESCE(r.data->>'Unidade Hospitalar', r.data->>'Unidade', '') AS u_nome,
          r.data->>'Função' AS funcao,
          r.data->>'Admissão' AS admissao_txt,
          r.data->>'Demissão' AS demissao_txt,
          r.data->>'Data Nascimento' AS nasc_txt,
          r.data->>'Data Atestado' AS atestado_txt
        FROM stg_alterdata_v2_raw r
        JOIN latest l ON r.batch_id = l.batch_id
      ),
      norm AS (
        SELECT
          s.row_no,
          lpad(regexp_replace(coalesce(s.matricula_txt,''),'\\D','','g'), 5, '0') AS matricula_fmt,
          CASE
            WHEN coalesce(regexp_replace(s.cpf_txt,'\\D','','g'),'') <> '' THEN
              lpad(regexp_replace(s.cpf_txt,'\\D','','g'), 11, '0')
            ELSE NULL
          END AS cpf_puro,
          s.colaborador,
          s.u_nome,
          s.funcao,
          s.admissao_txt,
          s.demissao_txt,
          s.nasc_txt,
          s.atestado_txt
        FROM src s
      ),
      norm2 AS (
        SELECT
          n.*,
          CASE
            WHEN cpf_puro IS NULL THEN NULL
            ELSE substr(cpf_puro,1,3)||'.'||substr(cpf_puro,4,3)||'.'||substr(cpf_puro,7,3)||'-'||substr(cpf_puro,10,2)
          END AS cpf_fmt,
          CASE
            WHEN n.admissao_txt ~ '^\\d{4}-\\d{2}-\\d{2}' THEN to_char(to_date(n.admissao_txt,'YYYY-MM-DD'), 'DD/MM/YYYY')
            WHEN n.admissao_txt ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_char(to_date(n.admissao_txt,'DD/MM/YYYY'), 'DD/MM/YYYY')
            ELSE NULL
          END AS admissao_fmt,
          CASE
            WHEN n.demissao_txt ~ '^\\d{4}-\\d{2}-\\d{2}' THEN to_char(to_date(n.demissao_txt,'YYYY-MM-DD'), 'DD/MM/YYYY')
            WHEN n.demissao_txt ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_char(to_date(n.demissao_txt,'DD/MM/YYYY'), 'DD/MM/YYYY')
            ELSE NULL
          END AS demissao_fmt,
          CASE
            WHEN n.nasc_txt ~ '^\\d{4}-\\d{2}-\\d{2}' THEN to_char(to_date(n.nasc_txt,'YYYY-MM-DD'), 'DD/MM/YYYY')
            WHEN n.nasc_txt ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_char(to_date(n.nasc_txt,'DD/MM/YYYY'), 'DD/MM/YYYY')
            ELSE NULL
          END AS nascimento_fmt,
          CASE
            WHEN n.atestado_txt ~ '^\\d{4}-\\d{2}-\\d{2}' THEN to_char(to_date(n.atestado_txt,'YYYY-MM-DD'), 'DD/MM/YYYY')
            WHEN n.atestado_txt ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_char(to_date(n.atestado_txt,'DD/MM/YYYY'), 'DD/MM/YYYY')
            ELSE NULL
          END AS atestado_fmt
        FROM norm n
      ),
      joined AS (
        SELECT
          n2.*,
          m.regional
        FROM norm2 n2
        LEFT JOIN stg_unid_reg m ON m.unidade = n2.u_nome
      ),
      filtered AS (
        SELECT *,
          CASE WHEN (demissao_fmt IS NULL OR demissao_fmt = '') THEN 'admitido' ELSE 'demitido' END AS status_emp
        FROM joined
        WHERE 1=1
        ${whereQ}
        ${whereRegional}
        ${whereUnidade}
        ${whereStatus}
      )
      SELECT
        row_no,
        matricula_fmt AS "Matrícula",
        cpf_fmt       AS "CPF",
        colaborador   AS "Colaborador",
        u_nome        AS "Unidade Hospitalar",
        COALESCE(regional,'') AS "Regional",
        funcao        AS "Função",
        admissao_fmt  AS "Admissão",
        demissao_fmt  AS "Demissão",
        nascimento_fmt AS "Data Nascimento",
        atestado_fmt   AS "Data Atestado",
        status_emp    AS "Status"
      FROM filtered
      ORDER BY row_no
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows: any[] = await prisma.$queryRawUnsafe(sql);

    const countSql = `
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      ),
      src AS (
        SELECT r.row_no, r.data,
               r.data->>'Matrícula' AS matricula_txt,
               r.data->>'CPF' AS cpf_txt,
               r.data->>'Colaborador' AS colaborador,
               COALESCE(r.data->>'Unidade Hospitalar', r.data->>'Unidade', '') AS u_nome,
               r.data->>'Função' AS funcao,
               r.data->>'Admissão' AS admissao_txt,
               r.data->>'Demissão' AS demissao_txt,
               r.data->>'Data Nascimento' AS nasc_txt,
               r.data->>'Data Atestado' AS atestado_txt
        FROM stg_alterdata_v2_raw r
        JOIN latest l ON r.batch_id = l.batch_id
      ),
      norm AS (
        SELECT s.row_no,
               lpad(regexp_replace(coalesce(s.matricula_txt,''),'\\D','','g'), 5, '0') AS matricula_fmt,
               CASE WHEN coalesce(regexp_replace(s.cpf_txt,'\\D','','g'),'') <> '' THEN
                 lpad(regexp_replace(s.cpf_txt,'\\D','','g'), 11, '0')
               ELSE NULL END AS cpf_puro,
               s.colaborador, s.u_nome, s.funcao, s.admissao_txt, s.demissao_txt, s.nasc_txt, s.atestado_txt
        FROM src s
      ),
      norm2 AS (
        SELECT n.*,
               CASE WHEN cpf_puro IS NULL THEN NULL
                    ELSE substr(cpf_puro,1,3)||'.'||substr(cpf_puro,4,3)||'.'||substr(cpf_puro,7,3)||'-'||substr(cpf_puro,10,2)
               END AS cpf_fmt,
               CASE WHEN n.demissao_txt ~ '^\\d{4}-\\d{2}-\\d{2}' OR n.demissao_txt ~ '^\\d{2}/\\d{2}/\\d{4}' THEN 1 ELSE 0 END AS tem_demissao
        FROM norm n
      ),
      joined AS (SELECT n2.*, m.regional FROM norm2 n2 LEFT JOIN stg_unid_reg m ON m.unidade = n2.u_nome),
      filtered AS (
        SELECT *,
          CASE WHEN tem_demissao = 0 THEN 'admitido' ELSE 'demitido' END AS status_emp
        FROM joined
        WHERE 1=1
        ${whereQ}
        ${whereRegional}
        ${whereUnidade}
        ${whereStatus}
      )
      SELECT COUNT(*)::int AS total FROM filtered
    `;
    const totalRes: any[] = await prisma.$queryRawUnsafe(countSql);
    const total = totalRes?.[0]?.total ?? 0;

    const columns = [
      "Matrícula","CPF","Colaborador","Unidade Hospitalar","Regional",
      "Função","Admissão","Demissão","Data Nascimento","Data Atestado","Status"
    ];

    return NextResponse.json({ ok:true, rows, page, limit, total, columns });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
