-- TEA COHAB (NORTE) — fluxo CIPA por designação, gestão 2026
DELETE FROM cronograma_cipa
WHERE UPPER(TRIM(regional)) = 'NORTE'
  AND UPPER(TRIM(unidade)) = 'TEA COHAB'
  AND ano_gestao = 2026
  AND atividade_codigo IN (2, 3, 4, 5, 6, 7, 8);

UPDATE cronograma_cipa SET
  atividade_nome = 'Ofício Comunicação à Unidade e Sindicato',
  data_inicio_prevista = '2026-08-06',
  data_fim_prevista = '2026-08-06',
  data_conclusao = NULL,
  data_posse_gestao = '2025-09-01'
WHERE UPPER(TRIM(regional)) = 'NORTE' AND UPPER(TRIM(unidade)) = 'TEA COHAB'
  AND ano_gestao = 2026 AND atividade_codigo = 1;

UPDATE cronograma_cipa SET
  atividade_nome = 'Solicitação do Indicado (Designado) pelo Empregador',
  data_inicio_prevista = '2026-09-21',
  data_fim_prevista = '2026-09-21',
  data_conclusao = NULL,
  data_posse_gestao = '2025-09-01'
WHERE UPPER(TRIM(regional)) = 'NORTE' AND UPPER(TRIM(unidade)) = 'TEA COHAB'
  AND ano_gestao = 2026 AND atividade_codigo = 9;

UPDATE cronograma_cipa SET
  atividade_nome = 'Treinamento da CIPA (Designado)',
  data_inicio_prevista = '2026-09-29',
  data_fim_prevista = '2026-09-30',
  data_conclusao = NULL,
  data_posse_gestao = '2025-09-01'
WHERE UPPER(TRIM(regional)) = 'NORTE' AND UPPER(TRIM(unidade)) = 'TEA COHAB'
  AND ano_gestao = 2026 AND atividade_codigo = 10;

UPDATE cronograma_cipa SET
  atividade_nome = 'Emissão Certificado',
  data_inicio_prevista = '2026-10-06',
  data_fim_prevista = '2026-10-06',
  data_conclusao = NULL,
  data_posse_gestao = '2025-09-01'
WHERE UPPER(TRIM(regional)) = 'NORTE' AND UPPER(TRIM(unidade)) = 'TEA COHAB'
  AND ano_gestao = 2026 AND atividade_codigo = 11;

UPDATE cronograma_cipa SET
  atividade_nome = 'Reunião de Posse (Designado)',
  data_inicio_prevista = '2026-10-23',
  data_fim_prevista = '2026-10-23',
  data_conclusao = NULL,
  data_posse_gestao = '2025-09-01'
WHERE UPPER(TRIM(regional)) = 'NORTE' AND UPPER(TRIM(unidade)) = 'TEA COHAB'
  AND ano_gestao = 2026 AND atividade_codigo = 12;
