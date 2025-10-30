EMSERH — Correção de build (TypeScript ausente)

O que aconteceu
- O Vercel compilou o projeto, mas parou na fase de “Linting and checking validity of types”.
- Mensagem: “Please install typescript and @types/react”.
- Isso ocorre porque o projeto tem arquivos .ts/.tsx e tsconfig.json, mas as devDependencies não incluem TypeScript e types.

O que fazer (sem editar código da aplicação)
1) No painel do Vercel: Project → Settings → Build & Development Settings → Build Command.
2) Cole o conteúdo de `vercel_build_command.txt` (desse zip) no campo Build Command e salve.
   - Esse comando instala os pacotes de types antes do `next build`.
3) Dispare um novo deploy.
4) (Opcional e recomendado) Também adicione estas devDependencies no seu package.json e faça commit, usando o conteúdo de `devDependencies.json`.

Pacotes que serão instalados
- typescript (v5^)
- @types/react (v18^)
- @types/node (v20^)

Depois disso
- O erro atual some e o build continua.
