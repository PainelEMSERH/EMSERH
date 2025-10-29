Patch v9 — Corrige erro de TypeScript (falta de @types)

O Next detectou arquivos .ts/.tsx e parou a build por ausência de @types.
Este patch substitui o package.json para incluir:
  - typescript 5.6.3
  - @types/react 18.3.11
  - @types/node 20.14.10

Como aplicar:
  1) Copie package.json para a RAIZ do projeto (substitua).
  2) Copie next-env.d.ts para a RAIZ do projeto.
  3) Commit & Push no GitHub Desktop.
