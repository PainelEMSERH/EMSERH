
# HOTFIX — Alterdata Completo (Build errors)

Este hotfix corrige os erros do deploy que você reportou:

1) **"Exported identifiers must be unique"** em `AlterdataClient.tsx`  
   ➜ Havia dois `export default` no arquivo. Corrigido: agora há **apenas um** `export default (AlterdataClient)` que encapsula a `QueryClientProvider`, e o corpo foi movido para `AlterdataView`.

2) **"Module not found: Can't resolve 'zod'"**  
   ➜ O projeto não tinha `zod` (e libs TanStack) no `package.json`. Incluímos `package.json.merge.json` com as dependências necessárias.

3) **Lockfile ausente** (mensagem do `npm ci`)  
   ➜ Execute `npm install` **localmente** após aplicar o merge de dependências para gerar o `package-lock.json`. Em seguida suba o commit; o Vercel usará o lockfile e evitará o erro do `npm ci`.

---

## Como aplicar (passo a passo)

1. **Substitua** o arquivo:
   - Copie `app/(app)/colaboradores/alterdata/pro/AlterdataClient.tsx` deste pacote para o mesmo caminho no seu projeto (sobrescreva).

2. **Adicione as dependências no `package.json`**:  
   - Abra o seu `package.json` e garanta que, em `"dependencies"`, constem as entradas abaixo com versões iguais ou superiores:  
     - `"zod": "^3.23.8"`  
     - `"@tanstack/react-query": "^5.59.0"`  
     - `"@tanstack/react-virtual": "^3.1.0"`  
     - `"@tanstack/table-core": "^8.20.5"`  
   - Alternativamente, use o arquivo `package.json.merge.json` como referência de merge.

3. **Instale e gere lockfile localmente**:
   ```bash
   npm install
   ```
   Isso criará/atualizará o `package-lock.json` para que o `npm ci` do Vercel funcione.

4. **Commit & Deploy**:
   - `git add .`
   - `git commit -m "hotfix: alterdata default export + deps"`
   - `git push`

> Observação: Nenhuma alteração foi feita nos filtros ou comportamento de dados além do necessário para compilar e manter a página estável. A funcionalidade e a UX permanecem conforme o patch anterior, com paginação e cache.

Se quiser, eu preparo um **PR** só com essas mudanças para você aplicar com um clique.
