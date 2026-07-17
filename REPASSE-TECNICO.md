# EMSERH Painel — Repasse Técnico

Documento objetivo para onboarding de um novo desenvolvedor.

**Produção:** https://gestaoemserh.vercel.app  
**Repositório local (referência):** pasta `EMSERH` dentro de `EMSERH PAINEL`

---

## 1. O que é o sistema

Painel web interno da EMSERH para gestão de SESMT e indicadores operacionais:

- Entregas de EPI por colaborador/unidade
- Estoque SESMT
- Acidentes de trabalho (leitura + investigação)
- Extintores (SPCI)
- Ordens de serviço
- Demandas trabalhistas
- CIPA (cronograma de atividades por unidade/regional)
- Central de Ações GST (plano de ação)
- Dashboard e relatórios exportáveis
- Área admin (usuários, logs, importações, replicação CIPA)

Usuários são da rede EMSERH; acesso controlado por login (Clerk) + perfil no banco.

---

## 2. Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Estilo | Tailwind CSS 4 |
| Auth | Clerk (`@clerk/nextjs`) |
| ORM | Prisma 5 → PostgreSQL (Neon) |
| Gráficos | Chart.js + react-chartjs-2 |
| Planilhas | xlsx |
| Integração legado | SQL Server (Alterdata) via `mssql` — só em rotas específicas |
| Deploy | Vercel |

Node 20 recomendado. Scripts: `npm run dev`, `npm run build`, `npm start`.

---

## 3. Infraestrutura e acessos necessários

O novo dev precisa receber convite/acesso em:

1. **Git** — repositório do projeto (GitHub ou onde estiver hospedado)
2. **Vercel** — projeto `gestaoemserh` (env vars, deploys, logs)
3. **Neon** — PostgreSQL de produção/staging (`DATABASE_URL`)
4. **Clerk** — app de autenticação (`NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`)
5. **Alterdata** (opcional) — VPN/rede interna + credenciais SQL Server, se for mexer em importações Alterdata

### Variáveis de ambiente (mínimo local)

Criar `.env.local` na raiz:

```env
DATABASE_URL=postgresql://...          # Neon
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Opcional — integração Alterdata (rede interna)
ALTERDATA_SERVER=...
ALTERDATA_DATABASE=...
ALTERDATA_USER=...
ALTERDATA_PASSWORD=...
```

Copiar valores da Vercel (Settings → Environment Variables). Sem `DATABASE_URL` e Clerk, o build/dev quebra.

Após clonar:

```bash
npm install
npx prisma generate
npm run dev
```

---

## 4. Estrutura do código

```
app/
  (app)/          # Páginas autenticadas (dashboard, cipa, entregas, admin...)
  api/            # Route Handlers (REST interno)
  sign-in/        # Login Clerk
  layout.tsx      # Root + Providers (Clerk, tema)
components/       # UI compartilhada (AppShell, admin, charts)
lib/              # Regras de negócio por módulo (cipa/, spci/, entregas/...)
prisma/
  schema.prisma   # Modelos Prisma (Usuario, Entrega, Acidente, etc.)
middleware.ts     # Protege rotas — exige login Clerk
```

**Padrão geral:** páginas em `app/(app)/<modulo>/page.tsx` (muitas são Client Components) chamam APIs em `app/api/<modulo>/...`.

Menu lateral definido em `components/layout/AppShell.tsx`.

---

## 5. Autenticação e permissões

### Clerk
- Login obrigatório em quase tudo (`middleware.ts`).
- Rotas públicas: `/`, `/sign-in`, `/sign-up`.

### Tabela `Usuario` (Prisma)
Sincronizada no primeiro acesso (`app/(app)/layout.tsx`):

- Novo usuário → criado como `operador`, sem regional/unidade.
- Admin ajusta role e escopo em **Admin → Usuários**.

**Roles:** `admin` | `regional` | `unidade` | `operador`

### Admin
- E-mail root hardcoded: `jonathan.alves@emserh.ma.gov.br` (sempre admin).
- Demais admins: `Usuario.role = 'admin'` e `ativo = true`.
- Helper API: `lib/admin/ensure-admin-api.ts`.

---

## 6. Banco de dados — duas “camadas”

### A) Tabelas Prisma (`schema.prisma`)
Modeladas e usadas via `prisma.usuario`, `prisma.entrega`, etc.

Principais: `Usuario`, `Regional`, `Unidade`, `Colaborador`, `Entrega`, `Item`, `Kit`, `Acidente`, `AuditLog`, `PreferenciaUsuario`.

### B) Tabelas/views SQL “staging” (só `$queryRawUnsafe`)
**Não estão no Prisma.** Criadas/importadas manualmente ou via rotas de import no Neon:

| Objeto | Uso |
|--------|-----|
| `stg_alterdata_v2` | Colaboradores/funções vindos do Alterdata |
| `stg_unid_reg` | Mapa regional ↔ unidade |
| `stg_acidentes` | Acidentes importados de planilha |
| `stg_spci` | Extintores |
| `stg_ordens_servico` | Ordens de serviço |
| `stg_cipa` | Membros CIPA (complementar) |
| `cronograma_cipa` | **Cronograma CIPA** — datas por atividade/unidade/ano |

Muitos indicadores leem dessas tabelas `stg_*` + views. Ao debugar, conferir no **Neon SQL Editor** se a tabela existe e tem dados.

### Audit log
Tabela `"AuditLog"` (com aspas — case-sensitive no Postgres).  
Registra alterações recentes (ex.: `cipa_date_update` ao salvar datas CIPA). Histórico antigo pode não existir se a tabela foi criada depois.

---

## 7. Módulos principais (onde mexer)

### Entregas (`/entregas`)
- Core operacional: registrar entrega de EPI por colaborador.
- Depende de `stg_alterdata_v2`, kits, estoque.
- APIs: `app/api/entregas/*`

### CIPA (`/cipa`)
- Cronograma de atividades por unidade (2026 em foco).
- Dados em `cronograma_cipa` (SQL raw, não Prisma).
- **Salvar datas:** `POST /api/cipa/save` — atualiza só campos alterados; grava audit log.
- **Meta vs real:** `lib/cipa/meta-real-compute.ts`, `load-cronograma-rows.ts`
- **Diagnóstico:** aba só leitura, filtro por mês — `app/api/cipa/diagnostico`
- **Replicar 2026:** só admin, em `/admin` — **cuidado:** sobrescreve datas calculadas; não rodar depois de carga manual no Neon.

Lógica de nomes de unidade: `lib/cipa/unidades.ts` e `lib/cipa/process-rows.ts` (merge quando há variação de nome, ex. “HOSPITAL PAULINHO NEVES” vs canônico).

### Acidentes (`/acidentes`)
- Dados principais vêm de `stg_acidentes` (import CSV/planilha).
- Modelo Prisma `Acidente` existe, mas fluxo atual é leitura da staging.
- Investigação RIAT/CAT/SINAN: tabela `AcidenteInvestigacao`.

### SPCI Extintores (`/spci-extintores`)
- `stg_spci`, normalização de unidade em `lib/spci/`.

### Ordens de serviço, Demandas, Central GST
- Cada um com APIs em `app/api/<nome>/` e páginas correspondentes.
- Central GST usa `plano_acao_indicadores` (SQL raw).

### Admin (`/admin`)
- Usuários, logs, importar bases, replicar CIPA 2026.
- Importações: `app/(app)/admin/importar*` e `app/api/import/*`

### Alterdata
- Conexão direta SQL Server em rotas `app/api/alterdata/*`.
- Só funciona na rede interna EMSERH (não na Vercel em produção, salvo se houver túnel — verificar setup real).

---

## 8. Deploy (Vercel)

- Push na branch conectada → deploy automático.
- `vercel.json` força instalação extra de `chart.js` e `@next/swc-linux-x64-gnu` (workaround de build).
- Após mudar `schema.prisma`: rodar migration ou `prisma db push` no Neon **antes** de depender do código novo em prod.

---

## 9. Scripts úteis (pasta `scripts/`)

Scripts pontuais para carga/manutenção no Neon (ex.: import em massa CIPA NORTE 2026):

- `generate-cipa-norte-2026-sql.mjs` — gera SQL a partir de TSV, corrige datas inválidas (ex. 31/06 → 30/06)
- `norte-2026-update.sql` — UPDATE em lote por `id` (não duplica; substitui datas existentes)

Rodar SQL **direto no Neon**, não via app.

---

## 10. Pontos de atenção (evitar dor de cabeça)

1. **Datas CIPA** — sempre salvar como `YYYY-MM-DD`. UI aceita DD/MM/YYYY; API normaliza. Timezone pode confundir se converter errado no front.

2. **Nomes de unidade** — inconsistentes entre planilhas, Alterdata e `cronograma_cipa`. Preferir UPDATE por `id` em cargas em massa.

3. **Prisma vs raw SQL** — metade do sistema usa `$queryRawUnsafe`. Nem toda tabela aparece no `schema.prisma`.

4. **Dois clients Prisma** — `lib/prisma.ts` e `lib/db.ts` exportam instâncias similares; ambos existem no código legado.

5. **Acidentes** — rota save pode estar read-only / redirecionada para staging; confirmar antes de “reativar” edição.

6. **Admin root** — e-mail fixo no código; trocar exige editar `admin/page.tsx` e `ensure-admin-api.ts`.

7. **Build local** — precisa das env vars Clerk; sem elas `next build` falha.

8. **Replicar CIPA 2026** — operação destrutiva para datas customizadas; só admin, usar com critério.

---

## 11. Fluxo sugerido para o novo dev

1. Clonar repo, configurar `.env.local`, `npm install`, `npm run dev`
2. Logar com usuário de teste (Clerk) e ser promovido a admin
3. Explorar menu na ordem: Dashboard → Entregas → CIPA → Admin
4. Abrir Neon e inspecionar `cronograma_cipa`, `stg_unid_reg`, `"Usuario"`
5. Ler `app/api/cipa/save/route.ts` e `lib/cipa/` como exemplo de padrão do projeto
6. Fazer um deploy de teste na Vercel (preview) antes de merge em produção

---

## 12. Contatos / repasse operacional

Preencher antes de entregar:

| Item | Responsável / onde está |
|------|-------------------------|
| Repo Git | _____________________ |
| Vercel team | _____________________ |
| Neon project | _____________________ |
| Clerk app | _____________________ |
| Planilhas fonte (acidentes, CIPA, etc.) | _____________________ |
| VPN / Alterdata | _____________________ |

---

*Versão do doc: jun/2026 — projeto `emserh-next` v0.2.1*
