# EMSERH EPI — Pacote de Atualização (API + SQL + Docs)

Este pacote adiciona **API**, **SQL de criação de tabelas** e **instruções** para você integrar ao seu repositório atual (frontend Vite). 
Não precisa programar: basta **subir estes arquivos no GitHub** e configurar um **segundo projeto** na Vercel apontando para a pasta `api/` (monorepo).

## Estrutura
- `api/` — API (Hono) pronta para deploy na Vercel (Edge Runtime), integrada com **Clerk (JWT)** e **Neon (Postgres)** via Drizzle.
- `db/` — arquivos `.sql` para criar tabelas no Neon e **seeds** iniciais.
- `README-DEPLOY.md` — passo a passo simples para você fazer o deploy.

## Passo a passo resumido
1. Faça upload desta pasta **no seu repositório** (junto do frontend).
2. No **Neon**, abra o console SQL e rode os arquivos em `db/neon_bootstrap.sql` e depois `db/seed_regionais.sql`.
3. Na **Vercel**, crie **um novo projeto** a partir do *mesmo repositório*, mas definindo a **pasta raiz** como `api/` (Monorepo).
4. Configure as **variáveis de ambiente** do projeto `api/` (veja `api/.env.example`). 
5. No frontend, defina `VITE_API_BASE_URL` apontando para a URL do projeto `api`.
6. Publique. Você já terá endpoints funcionando (ex.: `/me`, `/regionais`, `/unidades`, `/funcoes`, `/epis`, `/kits`, `/colaboradores`).

> A integração com **Google Drive (ficha NR-06)** entra depois. O essencial para operação (cadastro expresso, catálogo e base de regionais/unidades) já fica pronto.

---

Gerado em 2025-10-29.
