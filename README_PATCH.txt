PATCH v13 — Clerk env + Dashboard sem SSR

1) Variáveis de ambiente (obrigatório)
   - No Clerk Dashboard, pegue:
     • Publishable Key (pk_...)
     • Secret Key (sk_...)
   - Na Vercel: Project → Settings → Environment Variables
     • Adicione NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_...
     • Adicione CLERK_SECRET_KEY = sk_...
     • Escopos: defina para "Production" e "Preview".
     • Clique "Save" e depois "Redeploy" (ou faça um novo commit).

2) Evitar erro getComputedStyle durante render no servidor
   - Este patch substitui app/page.tsx para carregar o Dashboard com:
     dynamic(() => import('@/components/pages/Dashboard'), { ssr: false })
   - Assim o Dashboard (que usa APIs do browser) só renderiza no cliente.

3) Como aplicar
   - Copie "app/page.tsx" para a pasta app/ do projeto (substitua).
   - (Opcional) Copie ".env.example" para a raiz e, localmente, crie seu ".env".
   - Commit & Push.

Observação
- Sem as variáveis da Clerk configuradas, a build/SSR quebra com "Missing publishableKey".
- Depois de setar as variáveis na Vercel, faça um redeploy.
