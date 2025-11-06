import React from 'react';
import NextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AlterdataFullClient = NextDynamic(() => import('@/components/alterdata/AlterdataFullClient'), { ssr: false });

export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-2 text-lg font-semibold">Alterdata — Base Completa</div>
      <p className="text-sm opacity-70 mb-4">
        Visual com Regional (join por Unidade) e filtros de Status/Regional/Unidade. Nada altera a base ou o upload.
      </p>
      <AlterdataFullClient />
    </div>
  );
}
