-- db/04_transform_load.sql
-- Constrói as tabelas finais a partir do staging

-- REGIONAIS
INSERT INTO regional (nome, sigla)
SELECT DISTINCT UPPER(TRIM(regional_responsavel)) AS nome,
       CASE UPPER(TRIM(regional_responsavel))
         WHEN 'NORTE' THEN 'NOR'
         WHEN 'SUL' THEN 'SUL'
         WHEN 'LESTE' THEN 'LES'
         WHEN 'CENTRO' THEN 'CEN'
         ELSE SUBSTRING(UPPER(TRIM(regional_responsavel)) FROM 1 FOR 3)
       END AS sigla
FROM stg_unid_reg sur
WHERE TRIM(regional_responsavel) <> ''
ON CONFLICT (nome) DO NOTHING;

-- UNIDADES
INSERT INTO unidade (nome, sigla, regionalId)
SELECT DISTINCT UPPER(TRIM(nmdepartamento)) AS nome,
       NULL::TEXT AS sigla,
       r.id
FROM stg_unid_reg u
JOIN regional r ON r.nome = UPPER(TRIM(u.regional_responsavel))
WHERE TRIM(nmdepartamento) <> ''
ON CONFLICT (nome) DO NOTHING;

-- FUNÇÕES
INSERT INTO funcao (nome)
SELECT DISTINCT UPPER(TRIM(funcao))
FROM stg_alterdata
WHERE TRIM(funcao) <> ''
ON CONFLICT (nome) DO NOTHING;

-- ITENS (somente os com quantidade > 0)
INSERT INTO item (nome, categoria, unidadeMedida, ativo)
SELECT DISTINCT UPPER(TRIM(epi_item)) AS nome, NULL, 'un', TRUE
FROM stg_epi_map
WHERE COALESCE(quantidade,0) > 0
  AND TRIM(epi_item) <> ''
ON CONFLICT (nome) DO NOTHING;

-- KITS por FUNÇÃO (um kit por função presente no mapa)
INSERT INTO kit (funcaoId, nome, descricao)
SELECT f.id, 'KIT ' || f.nome, NULL
FROM (
  SELECT DISTINCT UPPER(TRIM(alterdata_funcao)) AS funcao
  FROM stg_epi_map
  WHERE TRIM(alterdata_funcao) <> ''
) m
JOIN funcao f ON f.nome = m.funcao
ON CONFLICT (funcaoId) DO NOTHING;

-- KIT_ITEM
INSERT INTO kit_item (kitId, itemId, quantidade)
SELECT k.id, i.id, m.quantidade
FROM stg_epi_map m
JOIN funcao f ON f.nome = UPPER(TRIM(m.alterdata_funcao))
JOIN kit k ON k.funcaoId = f.id
JOIN item i ON i.nome = UPPER(TRIM(m.epi_item))
WHERE COALESCE(m.quantidade,0) > 0;

-- COLABORADORES (CPF único)
INSERT INTO colaborador (cpf, nome, source)
SELECT cpf_norm, MAX(colaborador) AS nome, 'alterdata'
FROM (
  SELECT REGEXP_REPLACE(COALESCE(cpf,''), '\D+', '', 'g') AS cpf_norm, colaborador
  FROM stg_alterdata
) s
WHERE cpf_norm <> ''
GROUP BY cpf_norm
ON CONFLICT (cpf) DO NOTHING;

-- VÍNCULOS
INSERT INTO colaborador_vinculo (colaboradorId, unidadeId, funcaoId, admissao, demissao, situacao, origem)
SELECT c.id,
       u.id AS unidadeId,
       f.id AS funcaoId,
       a.admissao,
       NULLIF(a.demissao, DATE '0001-01-01') AS demissao,
       CASE WHEN a.demissao IS NULL THEN 'ativo' ELSE 'demitido' END AS situacao,
       'alterdata' AS origem
FROM stg_alterdata a
JOIN colaborador c ON c.cpf = REGEXP_REPLACE(COALESCE(a.cpf,''), '\D+', '', 'g')
LEFT JOIN unidade u ON u.nome = UPPER(TRIM(a.unidade_hospitalar))
LEFT JOIN funcao f ON f.nome = UPPER(TRIM(a.funcao))
WHERE COALESCE(a.cpf,'') <> '';
