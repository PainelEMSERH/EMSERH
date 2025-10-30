-- db/05_views.sql
-- Views úteis e regra de elegibilidade mensal

CREATE OR REPLACE VIEW vw_colaborador_vinculo_atual AS
SELECT DISTINCT ON (c.id)
  c.id AS colaboradorId,
  c.cpf, c.nome,
  v.unidadeId, v.funcaoId, v.admissao, v.demissao,
  CASE WHEN v.demissao IS NULL THEN 'ativo' ELSE 'demitido' END AS situacao
FROM colaborador c
LEFT JOIN colaborador_vinculo v
  ON v.colaboradorId = c.id
  AND (v.admissao <= CURRENT_DATE AND (v.demissao IS NULL OR v.demissao > CURRENT_DATE))
ORDER BY c.id, v.admissao DESC;

CREATE OR REPLACE FUNCTION eligiveis_meta_mensal(p_ano INT, p_mes INT)
RETURNS TABLE (colaboradorId INT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH limites AS (
    SELECT make_date(p_ano, p_mes, 1) AS d1,
           (make_date(p_ano, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS d2,
           make_date(p_ano, 1, 1) AS jan1
  ),
  base AS (
    SELECT c.id, v.admissao, v.demissao
    FROM colaborador c
    JOIN colaborador_vinculo v ON v.colaboradorId = c.id
  ),
  candidatos AS (
    SELECT b.id AS colaboradorId, b.admissao, b.demissao, l.d1, l.d2, l.jan1
    FROM base b CROSS JOIN limites l
    WHERE NOT (b.demissao IS NOT NULL AND b.demissao < l.jan1)
      AND (b.admissao <= l.d2)
  ),
  entregou AS (
    SELECT e.colaboradorId, 1 AS flag
    FROM entrega e
    JOIN limites l ON 1=1
    WHERE e.data::date BETWEEN l.d1 AND l.d2
    GROUP BY e.colaboradorId
  )
  SELECT c.colaboradorId
  FROM candidatos c
  LEFT JOIN entregou en ON en.colaboradorId = c.colaboradorId
  WHERE NOT (
    c.demissao IS NOT NULL
    AND c.demissao BETWEEN c.d1 AND c.d2
    AND en.flag IS NULL
  )
  GROUP BY c.colaboradorId;
END $$;
