-- sql/etl_from_staging.sql
-- Pre-requisitos: staging tables
--   public.stg_unid_reg (nmedepartamento text, regional_responsavel text)
--   public.stg_epi_map (alterdata_funcao text, epi_item text, quantidade numeric, nome_site text)
--   public.stg_alterdata (cpf text, colaborador_nome text, funcao text, unidade_hospitalar text, admissao date, demissao date)
-- Este script popula as tabelas normalizadas com base nas staging.
-- Ajuste nomes se necessário.

BEGIN;

-- 1) Regionais
INSERT INTO "Regional" (id, nome, sigla)
SELECT gen_random_uuid()::text, INITCAP(TRIM(regional_responsavel)), UPPER(SUBSTRING(TRIM(regional_responsavel) FROM 1 FOR 3))
FROM (SELECT DISTINCT regional_responsavel FROM public.stg_unid_reg) r
ON CONFLICT (sigla) DO NOTHING;

-- 2) Unidades
INSERT INTO "Unidade" (id, regionalId, nome, sigla)
SELECT
  gen_random_uuid()::text,
  (SELECT id FROM "Regional" WHERE nome = INITCAP(TRIM(s.regional_responsavel)) LIMIT 1) as regionalId,
  INITCAP(TRIM(s.nmedepartamento)) as nome,
  UPPER(REGEXP_REPLACE(TRIM(s.nmedepartamento), '[^A-Z0-9]', '', 'g')) as sigla
FROM public.stg_unid_reg s
ON CONFLICT (regionalId, sigla) DO NOTHING;

-- 3) Funções (nome do site)
INSERT INTO "Funcao" (id, nome)
SELECT gen_random_uuid()::text, TRIM(nome_site)
FROM (SELECT DISTINCT nome_site FROM public.stg_epi_map WHERE NULLIF(TRIM(nome_site),'') IS NOT NULL) f
ON CONFLICT (nome) DO NOTHING;

-- 4) Itens de EPI (ignorando 'SEM EPI')
INSERT INTO "Item" (id, nome, categoria, unidadeMedida, ativo)
SELECT gen_random_uuid()::text,
       TRIM(epi_item) as nome,
       'EPI' as categoria,
       'un' as unidadeMedida,
       TRUE
FROM (SELECT DISTINCT epi_item FROM public.stg_epi_map WHERE UPPER(TRIM(epi_item)) <> 'SEM EPI' AND NULLIF(TRIM(epi_item),'') IS NOT NULL) i
ON CONFLICT (nome, categoria) DO NOTHING;

-- 5) Kits (um por função)
INSERT INTO "Kit" (id, funcaoId, nome)
SELECT gen_random_uuid()::text,
       f.id as funcaoId,
       'Kit padrão - ' || f.nome as nome
FROM "Funcao" f
ON CONFLICT (funcaoId) DO NOTHING;

-- 6) Kit -> Itens (map)
INSERT INTO "KitItem" (kitId, itemId, quantidade)
SELECT
  k.id as kitId,
  it.id as itemId,
  GREATEST(1, ROUND(COALESCE(NULLIF(TRIM(m.quantidade), '')::numeric, 1)))::int as quantidade
FROM public.stg_epi_map m
JOIN "Funcao" f ON f.nome = TRIM(m.nome_site)
JOIN "Kit" k ON k.funcaoId = f.id
JOIN "Item" it ON it.nome = TRIM(m.epi_item) AND it.categoria = 'EPI'
WHERE UPPER(TRIM(m.epi_item)) <> 'SEM EPI'
ON CONFLICT DO NOTHING;

-- 7) Colaboradores
-- Mapeia funcao (via alterdata_funcao -> nome_site) e unidade (via nmedepartamento).
INSERT INTO "Colaborador" (id, unidadeId, funcaoId, nome, matricula, email, telefone, status)
SELECT
  gen_random_uuid()::text,
  u.id as unidadeId,
  f.id as funcaoId,
  INITCAP(TRIM(a.colaborador_nome)) as nome,
  COALESCE(NULLIF(REGEXP_REPLACE(a.cpf, '[^0-9]', '', 'g'), ''), md5(a.colaborador_nome)) as matricula,
  NULL, NULL,
  CASE WHEN a.demissao IS NULL THEN 'ativo'::"StatusColaborador" ELSE 'inativo'::"StatusColaborador" END as status
FROM public.stg_alterdata a
LEFT JOIN public.stg_epi_map m ON UPPER(TRIM(m.alterdata_funcao)) = UPPER(TRIM(a.funcao))
LEFT JOIN "Funcao" f ON f.nome = COALESCE(TRIM(m.nome_site), TRIM(a.funcao))
LEFT JOIN "Unidade" u ON UPPER(u.nome) = UPPER(TRIM(a.unidade_hospitalar))
ON CONFLICT ("unidadeId", "matricula") DO NOTHING;

COMMIT;
