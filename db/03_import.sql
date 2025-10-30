-- db/03_import.sql
-- Execute com psql a partir da RAIZ do repositório (onde existe a pasta ./data)

\copy stg_alterdata (cpf, colaborador, funcao, unidade_hospitalar, admissao, demissao) FROM './data/Alterdata.cleaned.csv' CSV HEADER;
\copy stg_unid_reg (nmdepartamento, regional_responsavel) FROM './data/Unidades_vs_Regional.cleaned.csv' CSV HEADER;
\copy stg_epi_map (alterdata_funcao, epi_item, quantidade, nome_site) FROM './data/Alterdata_vs_EPI.cleaned.csv' CSV HEADER;
