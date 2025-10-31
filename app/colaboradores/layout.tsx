export const dynamic = 'force-dynamic'
export const revalidate = 0

// Importante: este layout NÃO cria casca própria.
// Ele apenas delega para o layout raiz, garantindo
// que sidebar/topbar sejam idênticos à Dashboard.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
