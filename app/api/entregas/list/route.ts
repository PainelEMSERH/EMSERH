import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/entregas/list?page=1&size=20&regional=&unidade=&q=&status=todos|pendente|entregue&year=2025
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const size = Math.min(200, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10)));
    const q = (url.searchParams.get("q") || "").trim();
    const regional = (url.searchParams.get("regional") || "").trim();
    const unidade = (url.searchParams.get("unidade") || "").trim();
    const status = (url.searchParams.get("status") || "todos").trim();
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10);

    const offset = (page - 1) * size;

    // pre-carrega listas de regionais e unidades
    const regionsRows: Array<{ regional: string | null; unidade: string | null }> =
      await prisma.$queryRawUnsafe(`
        SELECT DISTINCT COALESCE(regional, 'SEM REGIONAL') AS regional, unidade
        FROM stg_unid_reg
        WHERE unidade IS NOT NULL
        ORDER BY 1, 2
      `);

    const regions = Array.from(new Set(regionsRows.map((r) => r.regional || "SEM REGIONAL"))).filter(Boolean) as string[];
    const units = regionsRows.map((r) => `${r.regional || "SEM REGIONAL"} :: ${r.unidade}`);

    // Monta filtros para a query principal
    const filters: string[] = [];
    if (regional) filters.push(`COALESCE(u.regional, 'SEM REGIONAL') = $${filters.length + 1}`);
    if (unidade) filters.push(`a.unidade_hospitalar = $${filters.length + 1}`);
    if (q) {
      filters.push(`(
        a.colaborador ILIKE $${filters.length + 1} OR
        a.cpf ILIKE $${filters.length + 1} OR
        a.funcao ILIKE $${filters.length + 1} OR
        a.unidade_hospitalar ILIKE $${filters.length + 1}
      )`);
    }

    const params: any[] = [];
    if (regional) params.push(regional);
    if (unidade) params.push(unidade);
    if (q) params.push(`%${q}%`);

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // status filter handled after counting entregas_no_ano
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      WITH base AS (
        SELECT a.cpf, a.colaborador AS nome, a.funcao, a.unidade_hospitalar AS unidade,
               u.regional, a.admissao, a.demissao
        FROM stg_alterdata a
        LEFT JOIN stg_unid_reg u ON u.unidade = a.unidade_hospitalar
        ${whereSql}
      ),
      elegiveis AS (
        SELECT b.cpf, b.nome, b.funcao, b.regional, b.unidade, m.item, m.quantidade::int
        FROM base b
        JOIN stg_epi_map m ON m.funcao = b.funcao
        WHERE (b.admissao IS NULL OR b.admissao <= NOW()::date)
          AND (b.demissao IS NULL OR b.demissao >= NOW()::date)
      ),
      marcacoes AS (
        SELECT cpf, item, COUNT(*) AS entregas_no_ano
        FROM entrega_epi
        WHERE date_part('year', data_entrega) = $${params.length + 1}
        GROUP BY 1,2
      )
      SELECT e.cpf, e.nome, e.funcao, e.regional, e.unidade, e.item, e.quantidade,
             COALESCE(m.entregas_no_ano, 0) AS "entregasNoAno"
      FROM elegiveis e
      LEFT JOIN marcacoes m ON m.cpf = e.cpf AND m.item = e.item
      ORDER BY e.nome, e.item
      LIMIT $${params.length + 2} OFFSET $${params.length + 3}
      `,
      ...params,
      year,
      size,
      offset
    );

    // aplica filtro de status (em memória, por simplicidade)
    const filtered = rows.filter((r) => {
      if (status === "pendente") return (r.entregasNoAno || 0) === 0;
      if (status === "entregue") return (r.entregasNoAno || 0) > 0;
      return true;
    });

    // para total: estimativa simples (pode ser refinada com COUNT separado)
    const total = filtered.length + (page - 1) * size + (rows.length === size ? size : 0);

    return NextResponse.json({
      ok: true,
      rows: filtered,
      total,
      page,
      size,
      regions,
      units,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
