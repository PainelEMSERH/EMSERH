export const dynamic = 'force-dynamic'
export const revalidate = 0

// Layout "vazio": usa 100% o layout raiz (mesma sidebar/topbar da Dashboard).
// Assim, ao navegar para /colaboradores, apenas o CONTEÚDO muda.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
