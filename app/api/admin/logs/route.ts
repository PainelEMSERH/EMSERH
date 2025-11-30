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
  } catch {
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
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      logs,
    });
  } catch (e) {
    console.error('[admin/logs] error loading logs', e);
    // Não quebra a tela: apenas retorna lista vazia
    return NextResponse.json({
      ok: true,
      logs: [],
    });
  }
}
