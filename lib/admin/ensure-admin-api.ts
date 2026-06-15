import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

export async function ensureAdminApi() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false as const, status: 401, reason: 'UNAUTHENTICATED' as const };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';

  if (!email) {
    return { ok: false as const, status: 403, reason: 'FORBIDDEN' as const };
  }

  if (email === ROOT_ADMIN_EMAIL) {
    return { ok: true as const, email };
  }

  try {
    const dbUser = await prisma.usuario.findUnique({ where: { email } });
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) {
      return { ok: true as const, email };
    }
  } catch (e) {
    console.error('[ensureAdminApi] erro ao consultar Usuario', e);
  }

  return { ok: false as const, status: 403, reason: 'FORBIDDEN' as const };
}
