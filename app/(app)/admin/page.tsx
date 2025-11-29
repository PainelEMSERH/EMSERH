import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import AdminLogsClient from '@/components/admin/AdminLogsClient';

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
    return { email, isRoot: true };
  }

  try {
    const dbUser = await prisma.usuario.findUnique({
      where: { email },
    });
    if (dbUser && dbUser.role === 'admin' && dbUser.ativo) {
      return { email, isRoot: false };
    }
  } catch {
    // se der erro, só deixamos o root admin passar
  }

  redirect('/');
}

export default async function Page() {
  const admin = await ensureAdmin();

  const totalUsuarios = await prisma.usuario.count().catch(() => 0);
  const totalRegionais = await prisma.regional.count().catch(() => 0);
  const totalUnidades = await prisma.unidade.count().catch(() => 0);

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
          <h2 className="text-sm font-semibold mb-1">Usuários & permissões</h2>
          <p className="text-xs text-muted mb-3">
            Controle de papéis (admin, regional, unidade, operador) e escopo de acesso.
          </p>
          <p className="text-xs text-muted mb-1">
            Usuários cadastrados: <span className="font-semibold">{totalUsuarios}</span>
          </p>
          <p className="text-xs text-muted">
            Regionais: <span className="font-semibold">{totalRegionais}</span> • Unidades:{' '}
            <span className="font-semibold">{totalUnidades}</span>
          </p>
          <div className="mt-3">
            <span className="inline-flex items-center rounded-lg border border-border px-3 py-1 text-[11px] text-muted">
              Gestão detalhada de usuários será adicionada em uma próxima etapa.
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Ferramentas de dados</h2>
          <p className="text-xs text-muted mb-3">
            Importação da base Alterdata e outras operações que impactam todas as regionais.
          </p>
          <ul className="text-xs text-muted list-disc list-inside space-y-1">
            <li>Importar Alterdata: <span className="font-semibold">exclusivo do usuário root</span>.</li>
            <li>Demais admins podem acompanhar o log de ações, mas não importar.</li>
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <a
              href="/admin/importar"
              className="inline-flex items-center rounded-lg border border-border px-3 py-1 text-[11px] hover:bg-panel/80"
            >
              Ir para Importar Alterdata
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Segurança & auditoria</h2>
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

      <AdminLogsClient />
    </div>
  );
}
