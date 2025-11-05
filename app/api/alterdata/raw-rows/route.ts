
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function esc(s: string){ return (s||'').replace(/'/g, "''"); }
function norm(expr: string){
  return `regexp_replace(upper(${expr}), '[^A-Z0-9]', '', 'g')`;
}

const FALLBACK_VALUES = `VALUES
        ('AGENCIA TRANSFUSIONAL BARRA DO CORDA','CENTRO'),
        ('AGENCIA TRANSFUSIONAL CHAPADINHA','LESTE'),
        ('AGENCIA TRANSFUSIONAL COLINAS','CENTRO'),
        ('AGENCIA TRANSFUSIONAL DE SÃO JOÃO DOS PATOS','CENTRO'),
        ('AGENCIA TRANSFUSIONAL DE VIANA','NORTE'),
        ('AGENCIA TRANSFUSIONAL TIMON','LESTE'),
        ('CAF - FEME','NORTE'),
        ('CAF - SEDE EMSERH','NORTE'),
        ('CASA DA GESTANTE, BEBE E PUERPERA','SUL'),
        ('CASA TEA 12+','NORTE'),
        ('CENTRAL DE REGULACAO - AMBULATORIAL','NORTE'),
        ('CENTRAL DE REGULACAO - LEITOS','NORTE'),
        ('CENTRAL DE REGULACAO - TRANSPORTE','NORTE'),
        ('CENTRO DA PESSOA IDOSA','SUL'),
        ('CENTRO DE SAUDE GENESIO REGO','NORTE'),
        ('CENTRO DE TERAPIA RENAL SUBSTITUTIVA','NORTE'),
        ('CENTRO ESPECIALIDADES MEDICAS PAM DIAMANTE','NORTE'),
        ('CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA','NORTE'),
        ('CENTRO ESPECIALIZADO DE REABILITACAO OLHO D AGUA','NORTE'),
        ('EMSERH SEDE','NORTE'),
        ('EMSERH SEDE DIRETORIA','NORTE'),
        ('FEME','NORTE'),
        ('FEME - UGAF','NORTE'),
        ('FEME DE CAXIAS','LESTE'),
        ('FEME IMPERATRIZ','SUL'),
        ('FESMA','NORTE'),
        ('HEMOMAR','NORTE'),
        ('HEMONUCLEO DE BACABAL','CENTRO'),
        ('HEMONUCLEO DE BALSAS','SUL'),
        ('HEMONUCLEO DE CAXIAS','LESTE'),
        ('HEMONUCLEO DE CODO','LESTE'),
        ('HEMONUCLEO DE IMPERATRIZ','SUL'),
        ('HEMONUCLEO DE PEDREIRAS','CENTRO'),
        ('HEMONUCLEO PINHEIRO','NORTE'),
        ('HEMONUCLEO SANTA INES','SUL'),
        ('HOSPITAL ADELIA MATOS FONSECA','LESTE'),
        ('HOSPITAL AQUILES LISBOA','NORTE'),
        ('HOSPITAL DA ILHA','NORTE'),
        ('HOSPITAL DE BARREIRINHAS','NORTE'),
        ('HOSPITAL DE CUIDADOS INTENSIVOS - HCI','NORTE'),
        ('HOSPITAL DE PAULINO NEVES','NORTE'),
        ('HOSPITAL DE PEDREIRAS','CENTRO'),
        ('HOSPITAL E MATERNIDADE ADERSON MARINHO - P. FRANCO','SUL'),
        ('HOSPITAL GENESIO REGO','NORTE'),
        ('HOSPITAL GERAL DE ALTO ALEGRE','LESTE'),
        ('HOSPITAL GERAL DE GRAJAU','CENTRO'),
        ('HOSPITAL GERAL DE PERITORO','LESTE'),
        ('HOSPITAL MACROREGIONAL DE CAXIAS','LESTE'),
        ('HOSPITAL MACROREGIONAL DE COROATA','LESTE'),
        ('HOSPITAL MACRORREGIONAL DRA RUTH NOLETO','SUL'),
        ('HOSPITAL MATERNO INFANTIL IMPERATRIZ','SUL'),
        ('HOSPITAL PRESIDENTE DUTRA','CENTRO'),
        ('HOSPITAL PRESIDENTE VARGAS','NORTE'),
        ('HOSPITAL REGIONAL ALARICO NUNES PACHECO - Timon','LESTE'),
        ('HOSPITAL REGIONAL DE BARRA DO CORDA','CENTRO'),
        ('HOSPITAL REGIONAL DE CARUTAPERA','NORTE'),
        ('HOSPITAL REGIONAL DE CHAPADINHA','LESTE'),
        ('HOSPITAL REGIONAL DE LAGO DA PEDRA','CENTRO'),
        ('HOSPITAL REGIONAL DE MORROS','NORTE'),
        ('HOSPITAL REGIONAL DE TIMBIRAS','LESTE'),
        ('HOSPITAL REGIONAL SANTA LUZIA DO PARUA','NORTE'),
        ('HOSPITAL VILA LUIZAO','NORTE'),
        ('LACEN','NORTE'),
        ('LACEN IMPERATRIZ','SUL'),
        ('POLICLINICA AÇAILANDIA','SUL'),
        ('POLICLINICA BARRA DO CORDA','CENTRO'),
        ('POLICLINICA CAXIAS','LESTE'),
        ('POLICLINICA CIDADE OPERARIA','NORTE'),
        ('POLICLINICA COHATRAC','NORTE'),
        ('POLICLINICA DE CODÓ','LESTE'),
        ('POLICLINICA DE IMPERATRIZ','SUL'),
        ('POLICLINICA DE MATOES DO NORTE','LESTE'),
        ('POLICLINICA DO COROADINHO','NORTE'),
        ('POLICLINICA DO CUJUPE','NORTE'),
        ('POLICLINICA VILA LUIZAO','NORTE'),
        ('POLICLINICA VINHAIS','NORTE'),
        ('PROGRAMA DE ACAO INTEGRADA PARA APOSENTADOS - PAI','NORTE'),
        ('RESIDENCIA MEDICA E MULTI - ANALISTAS TECNICOS','NORTE'),
        ('SHOPPING DA CRIANÇA','NORTE'),
        ('SOLAR DO OUTONO','NORTE'),
        ('SVO -SERV. VERIFICAÇÃO DE ÓBITOS - SÃO LUÍS','NORTE'),
        ('SVO -SERV. VERIFICAÇÃO DE ÓBITOS - TIMON','LESTE'),
        ('SVO -SERV.VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ','SUL'),
        ('TEA - CENTRO ESPECIALIZADO DE REAB. OLHO D AGUA','NORTE'),
        ('UPA ARACAGY','NORTE'),
        ('UPA CIDADE OPERARIA','NORTE'),
        ('UPA CODO','LESTE'),
        ('UPA COROATA','LESTE'),
        ('UPA DE IMPERATRIZ','SUL'),
        ('UPA ITAQUI BACANGA','NORTE'),
        ('UPA PAÇO DO LUMIAR','NORTE'),
        ('UPA PARQUE VITORIA','NORTE'),
        ('UPA SAO JOAO DOS PATOS','CENTRO'),
        ('UPA TIMON','LESTE'),
        ('UPA VINHAIS','NORTE')
`;

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

    const mapCte = `map AS (
      SELECT DISTINCT ON (nmddepartamento) nmddepartamento, regional_responsavel
      FROM (
        SELECT nmddepartamento, regional_responsavel FROM stg_unid_reg
        UNION ALL
        SELECT v.nmddepartamento, v.regional_responsavel
        FROM ( ${FALLBACK_VALUES} ) AS t(nm, rg)
        JOIN LATERAL (SELECT t.nm::text AS nmddepartamento, t.rg::text AS regional_responsavel) v ON true
      ) z
      WHERE nmddepartamento IS NOT NULL
    )`;

    if(regional){
      wh.push(`EXISTS (
        SELECT 1 FROM map ur
        WHERE EXISTS (
          SELECT 1 FROM jsonb_each_text(r.data) kv
          WHERE ${norm('kv.value')} = ${norm('ur.nmddepartamento')}
        ) AND ur.regional_responsavel = '${esc(regional)}'
      )`);
    }

    if(unidade){
      const u = esc(unidade);
      wh.push(`EXISTS (
        SELECT 1 FROM jsonb_each_text(r.data) kv
        WHERE ${norm('kv.value')} = ${norm('\'' + u + '\'')}
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
      ),
      ${mapCte}
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
      ),
      ${mapCte}
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
