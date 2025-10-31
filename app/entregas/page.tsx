'use client';

import React from 'react';

// Página de Entregas usando o App Router.
// Importante: NÃO envolver com AppShell aqui — o layout global já aplica
// header + sidebar automaticamente via app/layout.tsx.
// Mantemos a mesma hierarquia visual da tela inicial apenas mudando o conteúdo.

export default function EntregasPage() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Entregas</h1>
        <p className="mt-2 text-sm text-gray-400">
          Conteúdo em desenvolvimento.
        </p>
      </div>
    </div>
  );
}
