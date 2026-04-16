import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { ensurePlanoAcaoIndicadoresTable } from '@/lib/plano-acao-indicadores-ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(s: string) {
  return s.replace(/'/g, "''");
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
  }

  const id = (params.id || '').trim();
  if (!id || id.length > 80) {
    return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  }

  try {
    await ensurePlanoAcaoIndicadoresTable(prisma);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const darBaixa = Boolean(body.dar_baixa);

    const exists: any[] = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM plano_acao_indicadores WHERE id = '${esc(id)}' LIMIT 1`,
    );
    if (!exists?.length) {
      return NextResponse.json({ ok: false, error: 'Registro não encontrado' }, { status: 404 });
    }

    const setParts: string[] = ['updated_at = NOW()'];

    if ('comentarios' in body && body.comentarios != null) {
      setParts.push(`comentarios = '${esc(String(body.comentarios))}'`);
    }
    if ('evidencia' in body && body.evidencia != null) {
      setParts.push(`evidencia = '${esc(String(body.evidencia))}'`);
    }
    if ('novo_prazo' in body) {
      const np = body.novo_prazo == null ? '' : String(body.novo_prazo).trim();
      if (np) setParts.push(`novo_prazo = '${esc(np)}'::date`);
      else setParts.push(`novo_prazo = NULL`);
    }

    if (darBaixa) {
      const hoje = new Date().toISOString().slice(0, 10);
      setParts.push(`status = 'Concluído'`);
      setParts.push(`conclusao = '${esc(hoje)}'::date`);
    } else {
      if ('status' in body && body.status != null) {
        setParts.push(`status = '${esc(String(body.status))}'`);
      }
      if ('conclusao' in body) {
        const c = body.conclusao == null ? '' : String(body.conclusao).trim();
        if (c) setParts.push(`conclusao = '${esc(c)}'::date`);
        else setParts.push(`conclusao = NULL`);
      }
    }

    await prisma.$executeRawUnsafe(`
      UPDATE plano_acao_indicadores
      SET ${setParts.join(', ')}
      WHERE id = '${esc(id)}'
    `);

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error('[plano-acao-indicadores PATCH]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e || 'Erro ao atualizar') },
      { status: 500 },
    );
  }
}
