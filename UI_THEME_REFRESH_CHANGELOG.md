
# UI Theme Refresh — Vercel/Geist-inspired (2025-11-04)

## O que foi corrigido
- **Colaboradores (light)**: todo o conteúdo ficava invisível por causa de `text-white` na raiz. Substituído por `text-text`.
- **Entregas (dark/light)**: botões tinham `text-white` com `bg-panel` (quase branco no light), o que escondia o texto. Padronizado para **`.btn`** e **`.btn-primary`** com tokens.
- **Menu (light)**: itens inativos usavam `text-slate-300`, de baixo contraste no claro. Agora usam `text-muted` (token) com hover em `bg-panel`. Estado ativo usa `bg-panel` + `ring-border`.
- **Tokens**: mantido sistema baseado em CSS variables (Geist-like), com utilitários `bg-bg`, `bg-panel`, `bg-card`, `text-text`, `text-muted`, `border-border`.
- **Acessibilidade**: foco e rings apoiados por `--ring` e `ring-border`. Hover de tabelas e painéis ajustado via tokens.

## Arquivos alterados
- `app/(app)/colaboradores/page.tsx`
- `app/(app)/entregas/page.tsx`
- `components/layout/AppShell.tsx`
- `app/globals.css` (adição utilitária leve)

## Como testar
1. Troque entre **claro/escuro** no seletor do cabeçalho.
2. Verifique:
   - **Colaboradores**: texto visível em ambos os temas.
   - **Entregas**: nome e botões legíveis sem hover; hover apenas realça, não revela.
   - **Menu**: itens inativos legíveis no claro e no escuro; item ativo com pill sutil.
3. Revise contraste (WCAG AA) em botões e textos muteds.

