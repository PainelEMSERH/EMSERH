
import { ping } from "@/lib/db";

export default async function Page() {
  const now = await ping();
  return (
    <section className="grid gap-3">
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <div className="rounded-2xl border p-4 grid gap-2">
        <div><strong>Banco</strong>: conectado (ping em <code>{now}</code>)</div>
        <div><strong>Clerk</strong>: configurado via <code>ClerkProvider</code> / <code>middleware</code></div>
        <div><strong>Tema</strong>: alternar no cabeçalho (persistente)</div>
      </div>
    </section>
  )
}
