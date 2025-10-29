# Patch EMSERH — Clerk + Limpeza de Links (Frontend)

Este patch:
- Adiciona **Clerk** ao template Vite (login obrigatório).
- Remove o **Banner** promocional e links externos de venda.
- Troca o menu lateral para páginas da EMSERH mantendo o **mesmo layout**.
- Cria páginas-base: Colaboradores, Entregas, Pendências, Estoque, Kits, Relatórios, Admin, Config.

## Como aplicar (sem programar)
1. No seu repositório do frontend, **copie o conteúdo desta pasta** sobre a pasta do projeto (aceite substituir arquivos em `src/`).
2. Abra o `package.json` do projeto e, se pedir para substituir, aceite **este que vem no patch** (ele só adiciona `@clerk/clerk-react`).
3. No projeto da Vercel (frontend), crie a variável **VITE_CLERK_PUBLISHABLE_KEY** com o **mesmo valor** da sua `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (copie e cole).
4. Faça **commit** pelo GitHub Desktop e espere a Vercel publicar.
5. Ao abrir o site, você verá a tela de **login**. Depois do login, o dashboard carrega normalmente.

> Observação: este patch não mexe com Neon (banco) ainda. Apenas autenticação e organização de páginas.
Gerado em 2025-10-29.
