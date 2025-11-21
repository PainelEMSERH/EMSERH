
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) {
    return NextResponse.json({ rows: [] });
  }

  const cpfs = Array.from(new Set(ids.map(cpf => String(cpf).replace(/\D/g, '').slice(-11))));
  if (!cpfs.length) {
    return NextResponse.json({ rows: [] });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      regexp_replace(cpf, '[^0-9]', '', 'g') AS cpf_limpo,
      status,
      observacao
    FROM public.epi_colab_status
    WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = ANY($1::text[])
  `, cpfs);

  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const cpfRaw = String(body.cpf || '');
  const status = String(body.status || '').toUpperCase();
  const observacao = (body.observacao || '').toString().slice(0, 200);

  if (!cpfRaw || !status) {
    return NextResponse.json({ ok: false, error: 'cpf/status inválidos' }, { status: 400 });
  }

  const cpf = cpfRaw.replace(/\D/g, '').slice(-11);

  // garante apenas códigos que mapeamos na tela
  const allowed = [
    'ATIVO',
    'FERIAS',
    'INSS',
    'LICENCA_MATERNIDADE',
    'DEMITIDO_2025_SEM_EPI',
    'EXCLUIDO_META',
  ];
  if (!allowed.includes(status)) {
    return NextResponse.json({ ok: false, error: 'status inválido' }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    \`
    INSERT INTO public.epi_colab_status (cpf, status, observacao)
    VALUES ($1, $2, $3)
    ON CONFLICT (cpf)
    DO UPDATE SET status = EXCLUDED.status, observacao = EXCLUDED.observacao
    \`,
    cpf,
    status,
    observacao,
  );

  return NextResponse.json({ ok: true });
}
