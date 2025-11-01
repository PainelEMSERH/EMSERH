EMSERH • EPI — Cleaned build

Feito:
- Padronização do layout via app/(app)/layout.tsx com AppShell único.
- Removidos duplicados de rotas fora de (app).
- Criadas páginas: dashboard, colaboradores, entregas, pendencias, estoque, kits, relatorios, admin, configuracoes.
- Corrigido AppShell como Client Component ("use client").
- Adicionado lib/prisma.ts para resolver import "@/lib/prisma".
- API: /api/kits/list com SQL genérico (usando prisma.$queryRawUnsafe).

Observação:
- O conteúdo das páginas foi padronizado para evitar erro de build. Dados dinâmicos dependem do banco (Neon) e variáveis de ambiente.