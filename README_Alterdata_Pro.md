
# Patch: Alterdata Completo — Performance, Paginação, Cache e UX Pro

Este pacote entrega:
- **/api/alterdata/paginated**: endpoint paginado com filtros, **cacheado** e invalidável por **tag**.
- **Página Alterdata** reprojetada: carregamento imediato (skeleton + streaming), **tabela virtualizada** (linhas e colunas), **estado persistente** (voltar para a página sem recarregar tudo), filtros robustos.
- **SQL (Neon/Postgres)**: índices e *materialized view* para acelerar consultas.
- **Integração com upload/import**: ao importar novos dados, toda a cache relacionada é invalidada automaticamente.

> Compatível com Next.js App Router + Clerk + Prisma + Neon (Postgres).

---

## Como aplicar

1) **Backup** do seu repo atual.
2) **Copie** o conteúdo deste patch dentro do seu projeto, preservando caminhos:
   - `app/(app)/colaboradores/alterdata/` (substitui a página atual por uma versão PRO).
   - `app/api/alterdata/paginated/` (novo endpoint).
   - `lib/alterdata/` (schemas/úteis).
   - `components/ui/` (DataTablePro virtualizada).
   - `sql/alterdata_optimizations.sql` (rodar no Neon).
   - `lib/cache.ts` (helpers de cache/revalidate).
3) **Dependências** (instale uma vez):
   ```bash
   npm i @tanstack/react-query @tanstack/react-virtual @tanstack/table-core zod
   ```
4) **Env**: nenhuma nova variável obrigatória. Usa `DATABASE_URL` existente.
5) **Rodar SQL no Neon** (recomendado — acelera MUITO):
   - Execute o arquivo `sql/alterdata_optimizations.sql`
   - Índices e *views* serão criados **concurrently** (sem travar).

6) **Import/Upload**: atualizamos `app/api/alterdata/import/route.ts` para chamar `revalidateTag("alterdata")` após sucesso. Se preferir não substituir seu arquivo inteiro, copie somente o trecho marcado **// invalidate cache**.

7) **Build & Teste**:
   ```bash
   npm run build && npm start
   ```

---

## O que foi corrigido / melhorado

- **Demora de carregamento inicial**:
  - Consulta agora **paginada** no servidor com `LIMIT/OFFSET` + **índices** nas colunas usadas por filtros/ordenacao.
  - **Cache HTTP** (`s-maxage`, `stale-while-revalidate`) + **Next.js cache por tag** (`alterdata`).

- **Voltar para a página sem recarregar tudo**:
  - Estado de filtros/página guardado na **URL** e em **TanStack Query** (cache no cliente com `staleTime: Infinity`).
  - Ao navegar e voltar, os dados são resgatados do cache imediato (e só atualizados se houver invalidação pelo upload).

- **Paginação correta e responsiva**:
  - Servidor retorna `totalCount` e `pageCount` confiáveis.
  - Navegação por página, "tamanho da página" configurável, e **scroll virtualizado** para milhares de linhas.

- **Filtros robustos (sem bagunçar)**:
  - Esquema `zod` valida e normaliza filtros (Regional/Unidade/CPF/Nome/Situação/Cargo/Função/Intervalos).
  - Persistência na URL impede perda de estado ao recarregar ou compartilhar o link.

- **UI profissional**:
  - Tabela com **header colante**, **colunas redimensionáveis**, **ordenar por coluna**, **sticky actions**.
  - Skeleton/placeholder com **streaming** imediato (App Router + Suspense).

- **Invalidação precisa**:
  - Ao concluir upload/import (`/api/alterdata/import`), disparamos `revalidateTag("alterdata")`.
  - Clientes com cache local detectam a versão nova e atualizam sem bloquear a navegação.

---

## Observações importantes

- Se o dataset for **muito grande**, considere usar **keyset pagination** (já há suporte opcional no endpoint).
- Avaliamos que o gargalo principal era: _“consulta completa sem paginação consistente + renderização de milhares de linhas no cliente + ausência de cache e de preservação de estado de navegação”_. Este patch resolve esses pontos.
- **Cuidado com filtros**: o schema zod impede misturas inválidas; a UI só envia filtros válidos e todos são **parametrizados** em SQL, evitando injeções.

---

## DDL recomendada (rodar no Neon)

Veja `sql/alterdata_optimizations.sql` — cria índices nas colunas mais filtradas e uma *materialized view* exemplo (`mv_alterdata_flat`) com as colunas exatas usadas pela página.

---

## Suporte

Se precisar, posso ajustar para colunas/campos específicos da sua base `stg_alterdata`/`stg_alterdata_v2`.
