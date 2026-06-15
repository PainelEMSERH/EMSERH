import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import AdminUsersClient from '@/components/admin/AdminUsersClient';
import AdminLogsClient from '@/components/admin/AdminLogsClient';
import AdminCipaReplicarClient from '@/components/admin/AdminCipaReplicarClient';
import ImportarAlterdataClient from '@/components/admin/ImportarAlterdataClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function ensureAdmin() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';

  if (!email) {
    redirect('/');
  }

  if (email === ROOT_ADMIN_EMAIL) {
    // Garante presença na tabela Usuario como admin
    try {
      await prisma.usuario.upsert({
        where: { email },
        update: {
          nome: user?.fullName || user?.username || email,
          ativo: true,
          role: 'admin',
          clerkUserId: user?.id || '',
        },
        create: {
          id: user?.id || email,
          email,
          nome: user?.fullName || user?.username || email,
          ativo: true,
          role: 'admin',
          clerkUserId: user?.id || '',
        },
      });
    } catch (e) {
      console.error('[admin.ensureAdmin] erro ao garantir root admin', e);
    }
    return {
      email,
      isRoot: true as const,
      nome: user?.fullName || user?.username || email,
    };
  }

  try {
    const dbUser = await prisma.usuario.findUnique({
      where: { email },
      include: {
        regional: true,
        unidade: true,
      },
    });
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) {
      return {
        email,
        isRoot: false as const,
        nome: dbUser.nome || email,
      };
    }
  } catch (e) {
    console.error('[admin.ensureAdmin] erro ao consultar Usuario', e);
  }

  redirect('/');
}

export default async function Page() {
  const admin = await ensureAdmin();

  const totalUsuarios = await prisma.usuario.count().catch(() => 0);

  return (
    <div className="space-y-4">
      {/* Header — padrão do site */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            Sistema • Administração
          </p>
          <h1 className="mt-1 text-lg font-semibold">Administração do sistema</h1>
          <p className="mt-1 text-xs text-muted">
            Logado como <span className="font-medium">{admin.email}</span>
            {admin.isRoot && ' (root admin)'}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>{totalUsuarios} usuário(s) cadastrado(s)</span>
        </div>
      </div>

      {admin.isRoot && (
        <div className="space-y-4">
          <ImportarAlterdataClient />
          <div className="rounded-xl border border-border bg-panel p-4">
            <a
              href="/admin/importar-bases"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium hover:bg-bg transition-colors"
            >
              📥 Importar Outras Bases (SPCI, CIPA, Acidentes, OS)
            </a>
          </div>
        </div>
      )}

      <AdminCipaReplicarClient />

      <AdminUsersClient />

      <AdminLogsClient />
    </div>
  );
}
