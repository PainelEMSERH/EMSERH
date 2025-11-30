import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
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

  // Root admin sempre tem acesso total
  if (email === ROOT_ADMIN_EMAIL) {
    // Garante presença na tabela Usuario como admin
    try {
      await prisma.usuario.upsert({
        where: { email },
        update: {
          nome: user?.fullName || user?.username || email,
          ativo: true,
          role: 'admin',
          clerkUserId: user?.id || undefined,
        },
        create: {
          email,
          nome: user?.fullName || user?.username || email,
          ativo: true,
          role: 'admin',
          clerkUserId: user?.id || undefined,
        },
      });
    } catch {
      // se falhar, ainda assim deixamos o root admin acessar
    }
    return {
      email,
      isRoot: true as const,
      nome: user?.fullName || user?.username || email,
    };
  }

  // Demais admins precisam estar cadastrados na tabela Usuario
  try {
    const dbUser = await prisma.usuario.findUnique({
      where: { email },
    });
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) {
      return {
        email,
        isRoot: false as const,
        nome: dbUser.nome || email,
      };
    }
  } catch {
    // se der erro, só o root admin acessa
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
          <h2 className="text-sm font-semibold mb-1">Usuários &amp; permissões</h2>
          <p className="text-xs text-muted mb-3">
            Controle de papéis (admin, regional, unidade, operador) e escopo de acesso.
          </p>
          <p className="text-xs text-muted mb-1">
            Usuários cadastrados:{' '}
            <span className="font-semibold">{totalUsuarios}</span>
          </p>
          <p className="text-xs text-muted">
            Regionais: <span className="font-semibold">{totalRegionais}</span> • Unidades:{' '}
            <span className="font-semibold">{totalUnidades}</span>
          </p>
          <div className="mt-3">
            <span className="inline-flex items-center rounded-lg border border-border px-3 py-1 text-[11px] text-muted">
              Gestão detalhada de usuários (lista e edição de permissões) será adicionada em uma próxima etapa.
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Ferramentas de dados</h2>
          <p className="text-xs text-muted mb-3">
            Importação da base Alterdata e outras operações que impactam todas as regionais.
          </p>
          <ul className="text-xs text-muted list-disc list-inside space-y-1">
            <li>
              Importar Alterdata:{' '}
              <span className="font-semibold">exclusivo do usuário root</span>.
            </li>
            <li>
              Demais admins podem acompanhar o log de ações, mas não importar.
            </li>
          </ul>
          {!admin.isRoot && (
            <p className="mt-3 text-[11px] text-muted">
              Apenas o root admin pode executar a importação. Em caso de necessidade, solicite a ele.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Segurança &amp; auditoria</h2>
          <p className="text-xs text-muted mb-3">
            Monitoramento das ações críticas realizadas no sistema, com foco em operações de admin.
          </p>
          <ul className="text-xs text-muted list-disc list-inside space-y-1">
            <li>Registro de importações da base Alterdata.</li>
            <li>Registro de futuras alterações de permissões e configurações sensíveis.</li>
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Abaixo você encontra a lista das últimas ações registradas.
          </p>
        </div>
      </div>

      {admin.isRoot && (
        <div className="mt-2">
          <ImportarAlterdataClient />
        </div>
      )}

      <AdminLogsClient />
    </div>
  );
}
