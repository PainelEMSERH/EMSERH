# BRIEFING → IMPLEMENTAÇÃO (Resumo)

Este documento lista cada item do briefing e aponta onde foi implementado no patch.

## 1. Página de Entregas
- Carregamento rápido: **SWR** com cache `stale-while-revalidate` → `lib/swr.ts`, uso em `components/entregas/EntregasTable.tsx`
- Manter cache ao voltar: SWR `revalidateOnFocus: false`, `keepPreviousData: true` → `lib/swr.ts`
- Paginação: preferimos server-side; se API não suportar, fallback client-side → `components/entregas/EntregasTable.tsx`
- Colunas: Matrícula, Nome, Função, Unidade, Regional, Admissão, Demissão; CPF removido → `components/entregas/EntregasTable.tsx`
- Formatos: matrícula 5 dígitos, datas `dd/mm/aaaa`, 'Regional' com R maiúsculo → `lib/format.ts`
- Botão “Entregar” com modal exibindo kit por função; confirmação sem reload → `components/entregas/KitModal.tsx`
- Visual Vercel: classes + variáveis em `app/styles/vercel-theme.css`

## 2. Página de Estoque
- Tabela com colunas requisitadas → `components/estoque/EstoquePage.tsx`
- Ações de Entrada/Saída (modal) → idem
- Histórico paginado/filtrável e exportação CSV/XLSX → idem
- Alertas visuais para ponto de reposição → idem

## 3. Página de Kits
- Listagem e CRUD completo → `components/kits/KitsPage.tsx`
- Adicionar/remover itens (item + quantidade padrão) → idem
- Replicar kit para outras Regionais → idem

## 4. Pendentes integrados à Entregas
- Indicador ao lado do colaborador, filtro "Somente Pendentes", contador no cabeçalho → `components/entregas/EntregasTable.tsx` + `components/entregas/KitModal.tsx`

## 5. Layout/Visual Vercel
- Cores/Tipografia/Transições → `app/styles/vercel-theme.css`
- Sidebar/Header preservados (AppShell).

