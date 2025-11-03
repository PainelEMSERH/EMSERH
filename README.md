# EMSERH • EPI (Refactor)

Este pacote contém a reformulação completa do app com **AppShell unificado**, páginas funcionais para **Colaboradores / Entregas / Estoque / Pendências / Kits**, tema **claro/escuro** com persistência, integração com **Clerk** e **Neon (Postgres via Prisma)** e APIs que consultam as bases `stg_alterdata / stg_epi_map / stg_unid_reg` e as tabelas normalizadas.

## Como rodar
1. Copie `.env.example` para `.env` e preencha:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
DATABASE_URL=postgresql://USER:PASS@HOST/DB?sslmode=require
```
2. (opcional) Execute o ETL `sql/etl_from_staging.sql` para popular as tabelas normalizadas.
3. `npm i && npm run dev`

> Observação: a execução local depende das credenciais de banco e Clerk já ativas.

## Rotas principais
- `/` (Dashboard)
- `/colaboradores` (busca/filtros e manutenção)
- `/entregas` (filtros por Regional/Unidade, montagem automática de EPI por função, gravação de entrega)
- `/estoque` (estoque por Regional/Unidade/Item, alerta de mínimo)
- `/pendencias` (listagem e status)

## APIs novas
- `GET /api/estoque/list`
- `GET /api/pendencias/list`

As APIs existentes para **entregas** e **colaboradores** foram mantidas.

## Theming
- Toggle de tema em **Header**, persistido em `localStorage`.
- `globals.css` com tokens de cores e variantes Tailwind v4.

## Deploy
- Configure as mesmas variáveis de ambiente no **Vercel** do projeto.
- O banco Neon deve estar com SSL (`sslmode=require`).

---
Gerado automaticamente a partir do seu código-base original.
