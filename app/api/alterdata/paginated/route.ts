
// app/api/alterdata/paginated/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { normalizeQuery } from "@/lib/alterdata/schema";
import { buildOrder, buildWhere } from "@/lib/alterdata/query";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";
export const fetchCache = "force-cache";
export const revalidate = 3600;
export const runtime = "nodejs";
export const preferredRegion = "auto";

const SOURCE = "mv_alterdata_flat"; // fallback para stg_alterdata_v2 se necessário

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const input = normalizeQuery(json);

    const { sql: whereSql, params } = buildWhere(input);
    const orderBy = buildOrder(input);

    const limit = input.pagination.pageSize;
    const offset = (input.pagination.page - 1) * input.pagination.pageSize;

    const countSql = `SELECT COUNT(*)::int AS total FROM ${SOURCE} ${whereSql};`;
    const rowsSql = `
      SELECT id, regional, unidade, cpf, nome, cargo, funcao, situacao, admissao, updated_at
      FROM ${SOURCE}
      ${whereSql}
      ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const [countRes, rows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(countSql, ...params),
      prisma.$queryRawUnsafe<any[]>(rowsSql, ...params, limit, offset),
    ]);

    const totalCount = countRes?.[0]?.total ?? 0;
    const pageCount = Math.max(1, Math.ceil(totalCount / limit));

    const body = JSON.stringify({
      ok: true,
      page: input.pagination.page,
      pageSize: limit,
      totalCount,
      pageCount,
      rows,
    });

    const res = new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
    res.headers.set("x-data-source", SOURCE);
    return res;
  } catch (err: any) {
    console.error("alterdata/paginated error", err);
    return NextResponse.json({ ok: false, error: err?.message ?? "Internal Error" }, { status: 400 });
  }
}
