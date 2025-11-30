import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import AdminUsersClient from '@/components/admin/AdminUsersClient';
import AdminLogsClient from '@/components/admin/AdminLogsClient';
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

  const [totalUsuarios, totalRegionais, totalUnidades] = await Promise.all([
    prisma.usuario.count().catch(() => 0),
    prisma.regional.count().catch(() => 0),
    prisma.unidade.count().catch(() => 0),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Administração do sistema</h1>
        <p className="text-sm text-muted">
          Área reservada para administração, configuração de acesso e operações sensíveis.
        </p>
        <p className="text-xs text-muted">
          Logado como <span className="font-medium">{admin.email}</span>
          {admin.isRoot && ' (root admin)'}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Visão geral</h2>
          <p className="text-xs text-muted mb-3">
            Resumo dos principais elementos administrados pelo sistema.
          </p>
          <p className="text-xs text-muted mb-1">
            Usuários cadastrados:{' '}
            <span className="font-semibold">{totalUsuarios}</span>
          </p>
          <p className="text-xs text-muted mb-1">
            Regionais:{' '}
            <span className="font-semibold">{totalRegionais}</span>
          </p>
          <p className="text-xs text-muted">
            Unidades:{' '}
            <span className="font-semibold">{totalUnidades}</span>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Permissões &amp; escopo</h2>
          <p className="text-xs text-muted mb-3">
            Controle do que cada usuário pode ver: admins, gestores regionais, gestores de
            unidade e operadores.
          </p>
          <ul className="text-xs text-muted list-disc list-inside space-y-1">
            <li>
              Admins podem ver todas as regionais e unidades (conforme configuração futura nas
              telas).
            </li>
            <li>
              Gestores regionais enxergam apenas dados da própria regional.
            </li>
            <li>
              Gestores de unidade e operadores enxergam apenas a própria unidade.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Ferramentas de dados</h2>
          <p className="text-xs text-muted mb-3">
            Importação da base Alterdata e demais operações de alto impacto.
          </p>
          <ul className="text-xs text-muted list-disc list-inside space-y-1">
            <li>
              Importar Alterdata:{' '}
              <span className="font-semibold">exclusivo do usuário root</span>.
            </li>
            <li>Demais admins podem acompanhar o log de ações, mas não importar.</li>
          </ul>
        </div>
      </div>

      {admin.isRoot && (
        <div className="mt-4">
          <ImportarAlterdataClient />
        </div>
      )}

      <AdminUsersClient />

      <AdminLogsClient />
    </div>
  );
}
