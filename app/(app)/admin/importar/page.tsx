import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import ImportarAlterdataClient from '@/components/admin/ImportarAlterdataClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function ensureRootAdmin() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  if (email !== ROOT_ADMIN_EMAIL) {
    redirect('/');
  }
  return { email };
}

export default async function ImportarAlterdataPage() {
  await ensureRootAdmin();
  return <ImportarAlterdataClient />;
}
