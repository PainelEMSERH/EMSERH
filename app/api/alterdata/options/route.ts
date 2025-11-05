
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const FALLBACK: Array<{unidade: string; regional: string}> = [
  {
    "unidade": "AGENCIA TRANSFUSIONAL BARRA DO CORDA",
    "regional": "CENTRO"
  },
  {
    "unidade": "AGENCIA TRANSFUSIONAL CHAPADINHA",
    "regional": "LESTE"
  },
  {
    "unidade": "AGENCIA TRANSFUSIONAL COLINAS",
    "regional": "CENTRO"
  },
  {
    "unidade": "AGENCIA TRANSFUSIONAL DE SÃO JOÃO DOS PATOS",
    "regional": "CENTRO"
  },
  {
    "unidade": "AGENCIA TRANSFUSIONAL DE VIANA",
    "regional": "NORTE"
  },
  {
    "unidade": "AGENCIA TRANSFUSIONAL TIMON",
    "regional": "LESTE"
  },
  {
    "unidade": "CAF - FEME",
    "regional": "NORTE"
  },
  {
    "unidade": "CAF - SEDE EMSERH",
    "regional": "NORTE"
  },
  {
    "unidade": "CASA DA GESTANTE, BEBE E PUERPERA",
    "regional": "SUL"
  },
  {
    "unidade": "CASA TEA 12+",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRAL DE REGULACAO - AMBULATORIAL",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRAL DE REGULACAO - LEITOS",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRAL DE REGULACAO - TRANSPORTE",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRO DA PESSOA IDOSA",
    "regional": "SUL"
  },
  {
    "unidade": "CENTRO DE SAUDE GENESIO REGO",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRO DE TERAPIA RENAL SUBSTITUTIVA",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRO ESPECIALIDADES MEDICAS PAM DIAMANTE",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA",
    "regional": "NORTE"
  },
  {
    "unidade": "CENTRO ESPECIALIZADO DE REABILITACAO OLHO D AGUA",
    "regional": "NORTE"
  },
  {
    "unidade": "EMSERH SEDE",
    "regional": "NORTE"
  },
  {
    "unidade": "EMSERH SEDE DIRETORIA",
    "regional": "NORTE"
  },
  {
    "unidade": "FEME",
    "regional": "NORTE"
  },
  {
    "unidade": "FEME - UGAF",
    "regional": "NORTE"
  },
  {
    "unidade": "FEME DE CAXIAS",
    "regional": "LESTE"
  },
  {
    "unidade": "FEME IMPERATRIZ",
    "regional": "SUL"
  },
  {
    "unidade": "FESMA",
    "regional": "NORTE"
  },
  {
    "unidade": "HEMOMAR",
    "regional": "NORTE"
  },
  {
    "unidade": "HEMONUCLEO DE BACABAL",
    "regional": "CENTRO"
  },
  {
    "unidade": "HEMONUCLEO DE BALSAS",
    "regional": "SUL"
  },
  {
    "unidade": "HEMONUCLEO DE CAXIAS",
    "regional": "LESTE"
  },
  {
    "unidade": "HEMONUCLEO DE CODO",
    "regional": "LESTE"
  },
  {
    "unidade": "HEMONUCLEO DE IMPERATRIZ",
    "regional": "SUL"
  },
  {
    "unidade": "HEMONUCLEO DE PEDREIRAS",
    "regional": "CENTRO"
  },
  {
    "unidade": "HEMONUCLEO PINHEIRO",
    "regional": "NORTE"
  },
  {
    "unidade": "HEMONUCLEO SANTA INES",
    "regional": "SUL"
  },
  {
    "unidade": "HOSPITAL ADELIA MATOS FONSECA",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL AQUILES LISBOA",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL DA ILHA",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL DE BARREIRINHAS",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL DE CUIDADOS INTENSIVOS - HCI",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL DE PAULINO NEVES",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL DE PEDREIRAS",
    "regional": "CENTRO"
  },
  {
    "unidade": "HOSPITAL E MATERNIDADE ADERSON MARINHO - P. FRANCO",
    "regional": "SUL"
  },
  {
    "unidade": "HOSPITAL GENESIO REGO",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL GERAL DE ALTO ALEGRE",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL GERAL DE GRAJAU",
    "regional": "CENTRO"
  },
  {
    "unidade": "HOSPITAL GERAL DE PERITORO",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL MACROREGIONAL DE CAXIAS",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL MACROREGIONAL DE COROATA",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL MACRORREGIONAL DRA RUTH NOLETO",
    "regional": "SUL"
  },
  {
    "unidade": "HOSPITAL MATERNO INFANTIL IMPERATRIZ",
    "regional": "SUL"
  },
  {
    "unidade": "HOSPITAL PRESIDENTE DUTRA",
    "regional": "CENTRO"
  },
  {
    "unidade": "HOSPITAL PRESIDENTE VARGAS",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL REGIONAL ALARICO NUNES PACHECO - Timon",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL REGIONAL DE BARRA DO CORDA",
    "regional": "CENTRO"
  },
  {
    "unidade": "HOSPITAL REGIONAL DE CARUTAPERA",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL REGIONAL DE CHAPADINHA",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL REGIONAL DE LAGO DA PEDRA",
    "regional": "CENTRO"
  },
  {
    "unidade": "HOSPITAL REGIONAL DE MORROS",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL REGIONAL DE TIMBIRAS",
    "regional": "LESTE"
  },
  {
    "unidade": "HOSPITAL REGIONAL SANTA LUZIA DO PARUA",
    "regional": "NORTE"
  },
  {
    "unidade": "HOSPITAL VILA LUIZAO",
    "regional": "NORTE"
  },
  {
    "unidade": "LACEN",
    "regional": "NORTE"
  },
  {
    "unidade": "LACEN IMPERATRIZ",
    "regional": "SUL"
  },
  {
    "unidade": "POLICLINICA AÇAILANDIA",
    "regional": "SUL"
  },
  {
    "unidade": "POLICLINICA BARRA DO CORDA",
    "regional": "CENTRO"
  },
  {
    "unidade": "POLICLINICA CAXIAS",
    "regional": "LESTE"
  },
  {
    "unidade": "POLICLINICA CIDADE OPERARIA",
    "regional": "NORTE"
  },
  {
    "unidade": "POLICLINICA COHATRAC",
    "regional": "NORTE"
  },
  {
    "unidade": "POLICLINICA DE CODÓ",
    "regional": "LESTE"
  },
  {
    "unidade": "POLICLINICA DE IMPERATRIZ",
    "regional": "SUL"
  },
  {
    "unidade": "POLICLINICA DE MATOES DO NORTE",
    "regional": "LESTE"
  },
  {
    "unidade": "POLICLINICA DO COROADINHO",
    "regional": "NORTE"
  },
  {
    "unidade": "POLICLINICA DO CUJUPE",
    "regional": "NORTE"
  },
  {
    "unidade": "POLICLINICA VILA LUIZAO",
    "regional": "NORTE"
  },
  {
    "unidade": "POLICLINICA VINHAIS",
    "regional": "NORTE"
  },
  {
    "unidade": "PROGRAMA DE ACAO INTEGRADA PARA APOSENTADOS - PAI",
    "regional": "NORTE"
  },
  {
    "unidade": "RESIDENCIA MEDICA E MULTI - ANALISTAS TECNICOS",
    "regional": "NORTE"
  },
  {
    "unidade": "SHOPPING DA CRIANÇA",
    "regional": "NORTE"
  },
  {
    "unidade": "SOLAR DO OUTONO",
    "regional": "NORTE"
  },
  {
    "unidade": "SVO -SERV. VERIFICAÇÃO DE ÓBITOS - SÃO LUÍS",
    "regional": "NORTE"
  },
  {
    "unidade": "SVO -SERV. VERIFICAÇÃO DE ÓBITOS - TIMON",
    "regional": "LESTE"
  },
  {
    "unidade": "SVO -SERV.VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ",
    "regional": "SUL"
  },
  {
    "unidade": "TEA - CENTRO ESPECIALIZADO DE REAB. OLHO D AGUA",
    "regional": "NORTE"
  },
  {
    "unidade": "UPA ARACAGY",
    "regional": "NORTE"
  },
  {
    "unidade": "UPA CIDADE OPERARIA",
    "regional": "NORTE"
  },
  {
    "unidade": "UPA CODO",
    "regional": "LESTE"
  },
  {
    "unidade": "UPA COROATA",
    "regional": "LESTE"
  },
  {
    "unidade": "UPA DE IMPERATRIZ",
    "regional": "SUL"
  },
  {
    "unidade": "UPA ITAQUI BACANGA",
    "regional": "NORTE"
  },
  {
    "unidade": "UPA PAÇO DO LUMIAR",
    "regional": "NORTE"
  },
  {
    "unidade": "UPA PARQUE VITORIA",
    "regional": "NORTE"
  },
  {
    "unidade": "UPA SAO JOAO DOS PATOS",
    "regional": "CENTRO"
  },
  {
    "unidade": "UPA TIMON",
    "regional": "LESTE"
  },
  {
    "unidade": "UPA VINHAIS",
    "regional": "NORTE"
  }
];

function esc(s: string){ return (s||'').replace(/'/g, "''"); }

export async function GET(req: Request) {
  try{
    const { searchParams } = new URL(req.url);
    const regional = (searchParams.get('regional') || '').trim();

    let regs: Array<{regional: string}> = [];
    let unis: Array<{unidade: string}> = [];

    try{
      regs = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT regional_responsavel AS regional
        FROM stg_unid_reg
        WHERE regional_responsavel IS NOT NULL AND regional_responsavel <> ''
        ORDER BY 1
      `) as any;

      const uniSql = regional
        ? `SELECT nmddepartamento AS unidade FROM stg_unid_reg WHERE regional_responsavel = '${esc(regional)}' ORDER BY 1`
        : `SELECT nmddepartamento AS unidade FROM stg_unid_reg ORDER BY 1`;
      unis = await prisma.$queryRawUnsafe(uniSql) as any;
    }catch(e){ /* fallback abaixo */ }

    if(!regs || regs.length === 0){
      const set = new Set(FALLBACK.map(x => x.regional));
      regs = Array.from(set).sort().map(r => ({regional: r}));
    }
    if(!unis || unis.length === 0){
      const list = regional ? FALLBACK.filter(x => x.regional === regional) : FALLBACK;
      unis = list.map(x => ({unidade: x.unidade}));
    }

    return NextResponse.json({
      ok: true,
      regionais: regs.map(r => r.regional),
      unidades: unis.map(u => u.unidade),
    });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status:500 });
  }
}
