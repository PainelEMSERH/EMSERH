export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';
    const tipo = url.searchParams.get('tipo') || '';
    const status = url.searchParams.get('status') || '';
    const anoParam = url.searchParams.get('ano');
    const semFiltroAno = anoParam == null || anoParam === '' || String(anoParam).toLowerCase() === 'todos';
    const filterByYear = !semFiltroAno;
    const ano = filterByYear ? anoParam : String(new Date().getFullYear());
    const mes = url.searchParams.get('mes') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25', 10);
    const q = url.searchParams.get('q') || '';

    // Fonte: stg_acidentes no Neon. Filtro por ano: usa coluna ano se preenchida, senão deriva de data_acidente (suporta DD/MM/YYYY e YYYY-MM-DD).
    const anoNum = parseInt(ano, 10);
    const params: any[] = [];
    let p = 1;

    const dataParsedExpr = `(CASE
      WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (SUBSTRING(TRIM(data_acidente), 1, 10))::date
      WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' THEN to_date(SUBSTRING(TRIM(data_acidente), 1, 10), 'DD/MM/YYYY')
      ELSE NULL END)`;
    const yearExpr = `EXTRACT(YEAR FROM ${dataParsedExpr})::int`;
    const monthExpr = `EXTRACT(MONTH FROM ${dataParsedExpr})::int`;

    const where: string[] = [];
    if (filterByYear) {
      params.push(anoNum);
      where.push(`( (ano IS NOT NULL AND ano::int = $${p}) OR ( (ano IS NULL OR ano::text = '') AND ${dataParsedExpr} IS NOT NULL AND ${yearExpr} = $${p} ) )`);
      p++;
    }

    if (regional) {
      params.push(regional);
      where.push(`("Regional" ILIKE $${p++})`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      where.push(`(nmdepartamento ILIKE $${p++})`);
    }
    if (tipo) {
      params.push(tipo);
      where.push(`("Tipo_Acidente" ILIKE $${p++})`);
    }
    if (mes) {
      const mesNum = parseInt(mes, 10);
      params.push(mesNum);
      where.push(`( (mes IS NOT NULL AND mes::int = $${p}) OR ( (mes IS NULL OR mes::text = '') AND ${dataParsedExpr} IS NOT NULL AND ${monthExpr} = $${p} ) )`);
      p++;
    }
    if (q) {
      params.push(`%${q}%`);
      const qParam = `$${p++}`;
      where.push(`(
        "NmFuncionario" ILIKE ${qParam}
        OR nmdepartamento ILIKE ${qParam}
        OR COALESCE(numero_cat,'') ILIKE ${qParam}
        OR COALESCE(codigo_cid,'') ILIKE ${qParam}
        OR COALESCE(observacoes_cat,'') ILIKE ${qParam}
      )`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const offset = (page - 1) * pageSize;
    params.push(pageSize, offset);
    const limitParam = `$${p++}`;
    const offsetParam = `$${p++}`;

    const orderDataExpr = `(CASE WHEN ${dataParsedExpr} IS NOT NULL THEN ${dataParsedExpr}::timestamptz ELSE NULL END)`;
    const selectMesAno = `COALESCE(mes::int, ${monthExpr})::int AS "mes", COALESCE(ano::int, ${yearExpr})::int AS "ano"`;

    const rowsSql = `
      SELECT
        COALESCE(numero_cat, '') AS "numeroCAT",
        COALESCE("NmFuncionario",'') AS "nome",
        COALESCE(nmdepartamento,'') AS "unidadeHospitalar",
        NULLIF(TRIM(COALESCE("Regional",'')),'') AS "regional",
        COALESCE("Tipo_Acidente",'outros') AS "tipo",
        (LOWER(COALESCE(houve_afastamento::text,'')) IN ('verdadeiro','true','1','sim','t','yes','y')) AS "comAfastamento",
        (CASE WHEN ${dataParsedExpr} IS NOT NULL THEN ${dataParsedExpr}::timestamptz ELSE NULL END) AS "data",
        NULLIF(TRIM(COALESCE(hora_formatada, '')), '') AS "hora",
        ${selectMesAno},
        'aberto'::text AS "status",
        NULLIF(TRIM(COALESCE(descricao_complementar_lesao,'')),'') AS "descricao",
        NULLIF(TRIM(COALESCE(nmfuncao,'')),'') AS "funcaoTrabalhador",
        NULL::text AS "tipoVinculo",
        NULLIF(TRIM(COALESCE(descricao_situacao_geradora,'')),'') AS "causaImediata",
        NULLIF(TRIM(COALESCE(descricao_natureza_lesao,'')),'') AS "causaRaiz",
        NULLIF(TRIM(COALESCE(observacoes_cat,'')),'') AS "fatoresContrib",
        COALESCE("NrCPF",'') AS "cpf"
      FROM stg_acidentes
      ${whereSql}
      ORDER BY ${orderDataExpr} DESC NULLS LAST
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `;

    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM stg_acidentes
      ${whereSql}
    `;

    const [rows, tot] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql, ...params),
      prisma.$queryRawUnsafe<any[]>(totalSql, ...params.slice(0, params.length - 2)),
    ]);

    const total = tot?.[0]?.total ?? 0;

    // Chave estável (igual ao frontend): numeroCAT|dataISO|nome
    const toRef = (r: any) => {
      const cat = (r?.numeroCAT ?? '').toString().trim();
      const data = (r?.data ?? '').toString().replace(/T.*$/, '').trim();
      const nome = (r?.nome ?? '').toString().trim();
      return `${cat}|${data}|${nome}`;
    };
    const refs = rows.map(toRef).filter(Boolean);
    type InvSel = {
      acidenteRef: string;
      riatUrl: string | null;
      riatNome: string | null;
      sinanUrl: string | null;
      sinanNome: string | null;
    };
    let investigacoes: InvSel[] = [];
    if (refs.length > 0) {
      try {
        investigacoes = await prisma.acidenteInvestigacao.findMany({
          where: { acidenteRef: { in: refs } },
          select: {
            acidenteRef: true,
            riatUrl: true,
            riatNome: true,
            sinanUrl: true,
            sinanNome: true,
          },
        });
      } catch {
        investigacoes = [];
      }
    }
    const invByRef = new Map<string, InvSel>();
    for (const i of investigacoes) invByRef.set(i.acidenteRef, i);

    function docLink(nome: string | null | undefined, url: string | null | undefined) {
      const u = (url || '').trim();
      const n = (nome || '').trim();
      if (!u && !n) return null;
      const label =
        n ||
        (u
          ? u.replace(/^https?:\/\//i, '').length > 44
            ? u.replace(/^https?:\/\//i, '').slice(0, 44) + '…'
            : u.replace(/^https?:\/\//i, '')
          : '');
      return { label: label || 'Documento', href: u || null };
    }

    const rowsWithFlag = rows.map((r: any) => {
      const ref = toRef(r);
      const inv = invByRef.get(ref);
      const riatInvestigacao = inv ? docLink(inv.riatNome, inv.riatUrl) : null;
      const sinanInvestigacao = inv ? docLink(inv.sinanNome, inv.sinanUrl) : null;
      return {
        ...r,
        id: ref,
        hasInvestigacao: invByRef.has(ref),
        riatInvestigacao,
        sinanInvestigacao,
      };
    });

    return NextResponse.json({
      ok: true,
      rows: rowsWithFlag,
      total,
      page,
      pageSize,
    });
  } catch (e: any) {
    console.error('[acidentes/list] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
