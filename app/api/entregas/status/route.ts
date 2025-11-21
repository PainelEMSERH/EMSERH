import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ANO_REFERENCIA = 2025;

type StatusCode =
  | "ATIVO"
  | "FERIAS"
  | "INSS"
  | "LICENCA_MATERNIDADE"
  | "DEMITIDO_2025_SEM_EPI"
  | "EXCLUIDO_META";

const STATUS_ALLOWED: StatusCode[] = [
  "ATIVO",
  "FERIAS",
  "INSS",
  "LICENCA_MATERNIDADE",
  "DEMITIDO_2025_SEM_EPI",
  "EXCLUIDO_META",
];

function cleanCpf(v: unknown): string {
  return String(v || "")
    .replace(/\D/g, "")
    .slice(-11);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const idsRaw = idsParam.split(",").map((s) => s.trim());
  const cpfs = Array.from(new Set(idsRaw.map(cleanCpf).filter(Boolean)));
  if (!cpfs.length) {
    return NextResponse.json({ rows: [] });
  }

  // garante tabela para armazenar status, se ainda não existir
  await prisma.$executeRawUnsafe(
    "CREATE TABLE IF NOT EXISTS epi_colab_status (" +
      "cpf_limpo varchar(11) NOT NULL," +
      "ano_referencia integer NOT NULL," +
      "status varchar(40) NOT NULL," +
      "observacao varchar(200)," +
      "updated_at timestamptz NOT NULL DEFAULT now()," +
      "PRIMARY KEY (cpf_limpo, ano_referencia)" +
    ")"
  );

  const rows = await prisma.$queryRawUnsafe<any[]>(
    "SELECT cpf_limpo, status, observacao " +
      "FROM epi_colab_status " +
      "WHERE ano_referencia = $1 AND cpf_limpo = ANY($2::text[])",
    ANO_REFERENCIA,
    cpfs
  );

  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const cpf = cleanCpf(body.cpf);
  const statusRaw = String(body.status || "").toUpperCase().trim() as StatusCode;
  const observacao: string | null = (body.observacao || "")
    .toString()
    .slice(0, 200)
    .trim() || null;

  if (!cpf) {
    return NextResponse.json(
      { ok: false, error: "CPF inválido" },
      { status: 400 }
    );
  }

  if (!STATUS_ALLOWED.includes(statusRaw)) {
    return NextResponse.json(
      { ok: false, error: "Status inválido" },
      { status: 400 }
    );
  }

  await prisma.$executeRawUnsafe(
    "INSERT INTO epi_colab_status (cpf_limpo, ano_referencia, status, observacao) " +
      "VALUES ($1, $2, $3, $4) " +
      "ON CONFLICT (cpf_limpo, ano_referencia) " +
      "DO UPDATE SET status = EXCLUDED.status, observacao = EXCLUDED.observacao, updated_at = now()",
    cpf,
    ANO_REFERENCIA,
    statusRaw,
    observacao
  );

  return NextResponse.json({ ok: true });
}
