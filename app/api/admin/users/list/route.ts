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
    console.error('[admin/users/list.ensureAdmin] erro ao consultar Usuario', e);
    // se der erro, apenas o root admin tem acesso garantido
  }

  return { ok: false as const, status: 403, reason: 'FORBIDDEN' as const };
}

export async function GET() {
  const check = await ensureAdmin();
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.status },
    );
  }

  try {
    const [users, regionais, unidades] = await Promise.all([
      prisma.usuario.findMany({
        orderBy: { nome: 'asc' },
        include: {
          regional: true,
          unidade: true,
        },
      }),
      prisma.regional.findMany({
        orderBy: { nome: 'asc' },
      }),
      prisma.unidade.findMany({
        orderBy: { nome: 'asc' },
      }),
    ]);

    const usersOut = users.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      nome: u.nome,
      email: u.email,
      role: u.role,
      ativo: u.ativo,
      regionalId: u.regionalId,
      regionalNome: u.regional ? u.regional.nome : null,
      regionalSigla: u.regional ? u.regional.sigla : null,
      unidadeId: u.unidadeId,
      unidadeNome: u.unidade ? u.unidade.nome : null,
      unidadeSigla: u.unidade ? u.unidade.sigla : null,
    }));

    const regionaisOut = regionais.map((r) => ({
      id: r.id,
      nome: r.nome,
      sigla: r.sigla,
    }));

    const unidadesOut = unidades.map((u) => ({
      id: u.id,
      nome: u.nome,
      sigla: u.sigla,
      regionalId: u.regionalId,
    }));

    return NextResponse.json({
      ok: true,
      users: usersOut,
      regionais: regionaisOut,
      unidades: unidadesOut,
    });
  } catch (e) {
    console.error('[admin/users/list] erro ao carregar dados', e);
    // Em caso de erro, não quebramos a tela: retornamos listas vazias
    return NextResponse.json({
      ok: true,
      users: [],
      regionais: [],
      unidades: [],
    });
  }
}
