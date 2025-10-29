# Deploy — Passo a Passo (Sem programar)

## 1) Subir arquivos no GitHub
- Copie as pastas `api/` e `db/` para dentro do seu repositório atual (onde está o frontend Vite).
- Faça commit e push pelo GitHub Desktop.

## 2) Criar as tabelas no **Neon**
- Acesse o projeto do Neon (o mesmo que já está ligado na Vercel).
- Abra o **SQL Editor** e execute:
  1. O conteúdo de `db/neon_bootstrap.sql`
  2. Depois o conteúdo de `db/seed_regionais.sql`

## 3) Criar um **novo projeto** na Vercel para a API (Monorepo)
- Na Vercel, clique em **New Project** → **Importar Repositório** → selecione **o mesmo repositório** do frontend.
- Em **Root Directory**, selecione **`api/`**.
- Em **Framework Preset**, escolha **Other**.
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- Em **Environment Variables**, adicione (veja `api/.env.example`):
  - `CLERK_SECRET_KEY`
  - `CLERK_JWT_ISSUER`
  - `CLERK_JWT_AUDIENCE`
  - `DATABASE_URL` (Neon)
- Finalize o deploy.

## 4) Ajustar o frontend
- No projeto do frontend, crie/ajuste `.env` com:
  - `VITE_API_BASE_URL=https://SEU-PROJETO-API.vercel.app`
- Faça commit e push. O frontend irá usar a API automaticamente.

## 5) Testes rápidos
- Abra `https://SEU-PROJETO-API.vercel.app/me` (o frontend chamará isso após login).
- Use os endpoints:
  - `GET /regionais`
  - `GET /unidades?regional_id=...`
  - `GET /funcoes`
  - `GET /epis`
  - `GET /kits`
  - `GET /colaboradores`

> Pronto! Quando quiser, adicionamos **Google Drive (assinatura + PDF)** e **Alterdata**.
