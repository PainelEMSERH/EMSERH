# EMSERH Revamp

Reforma completa do layout com **AppShell unificado**, **modo escuro/claro**, **Clerk** e **Neon**.

## Rotas preservadas do projeto original (14):
/, /(app)/admin, /(app)/colaboradores, /(app)/configuracoes, /(app)/dashboard, /(app)/entregas, /(app)/estoque, /(app)/kits, /(app)/pendencias, /(app)/relatorios, /sign-in/[[...sign-in]], /sign-up/[[...sign-up]], /signin/[[...sign-in]], /signup/[[...sign-up]]

## Como rodar
```bash
npm i
cp .env.example .env.local  # preencha Clerk e Neon
npm run dev
```


## Copiar e colar (Vercel/GitHub)
- Você pode **substituir o conteúdo do repositório** por estes arquivos (sem mudar envs).
- As variáveis já em **Vercel → Project Settings → Environment Variables** continuarão válidas.
- Não é obrigatório ter `.env.local` no repo.

## Tabelas auxiliares criadas automaticamente
- `entregas_log` — registro de marcações de entrega (não altera suas tabelas de origem).
- `colaborador_movimentos` — log de movimentos/estado de colaboradores.

> As consultas leem de: `stg_alterdata`, `stg_epi_map`, `stg_unid_reg`.
