// Copie este arquivo como base para páginas que precisam de login.
// Ex.: app/admin/page.tsx, app/colaboradores/page.tsx, etc.
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProtectedPageTemplate() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  return <div>Conteúdo protegido</div>
}
