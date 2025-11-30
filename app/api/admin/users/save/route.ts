import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function ensureAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false as const, status: 401, reason: 'UNAUTHENTICATED' as const };
  }
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';

  if (!email) {
    return { ok: false as const, status: 403, reason: 'FORBIDDEN' as const };
  }

  if (email === ROOT_ADMIN_EMAIL) {
    return { ok: true as const, email };
  }

  try {
    const dbUser = await prisma.usuario.findUnique({
      where: { email },
    });
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) {
      return { ok: true as const, email };
    }
  } catch (e) {
    console.error('[admin/users/save.ensureAdmin] erro ao consultar Usuario', e);
    // se der erro, apenas o root admin tem acesso garantido
  }

  return { ok: false as const, status: 403, reason: 'FORBIDDEN' as const };
}

export async function POST(req: Request) {
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.status },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  const { id, role, ativo, regionalId, unidadeId } = body || {};
  if (!id || !role) {
    return NextResponse.json(
      { ok: false, error: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  if (!['admin', 'regional', 'unidade', 'operador'].includes(role)) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_ROLE' },
      { status: 400 },
    );
  }

  // Normaliza escopo de acordo com o papel
  let newRegionalId: string | null = regionalId ?? null;
  let newUnidadeId: string | null = unidadeId ?? null;

  if (role === 'admin') {
    newRegionalId = null;
    newUnidadeId = null;
  } else if (role === 'regional') {
    newUnidadeId = null;
  } else if (role === 'unidade' || role === 'operador') {
    // Para unidade / operador, ambos regionalId e unidadeId fazem sentido
    if (!newUnidadeId) {
      return NextResponse.json(
        { ok: false, error: 'UNIDADE_REQUIRED' },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.usuario.update({
      where: { id },
      data: {
        role,
        ativo: !!ativo,
        regionalId: newRegionalId,
        unidadeId: newUnidadeId,
      },
      include: {
        regional: true,
        unidade: true,
      },
    });

    const userOut = {
      id: updated.id,
      clerkUserId: updated.clerkUserId,
      nome: updated.nome,
      email: updated.email,
      role: updated.role,
      ativo: updated.ativo,
      regionalId: updated.regionalId,
      regionalNome: updated.regional ? updated.regional.nome : null,
      regionalSigla: updated.regional ? updated.regional.sigla : null,
      unidadeId: updated.unidadeId,
      unidadeNome: updated.unidade ? updated.unidade.nome : null,
      unidadeSigla: updated.unidade ? updated.unidade.sigla : null,
    };

    return NextResponse.json({ ok: true, user: userOut });
  } catch (e) {
    console.error('[admin/users/save] erro ao atualizar Usuario', e);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
