import AppShell from '@/components/AppShell'

export const metadata = {
  title: 'Entregas • EMSERH • EPI',
  description: 'Registro e confirmação de entregas de EPI por colaborador (com filtros de Regional/Unidade).',
}

export default function EntregasPage() {
  return (
    <AppShell>
      <div className="bg-[#111827] rounded-lg border border-gray-800 p-6">
        <h1 className="text-2xl font-semibold mb-2">Entregas</h1>
        <p className="text-gray-400">Conteúdo em desenvolvimento.</p>
      </div>
    </AppShell>
  )
}
