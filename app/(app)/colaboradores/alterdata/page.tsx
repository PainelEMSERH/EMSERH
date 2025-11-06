import React from 'react';
import dynamic from 'next/dynamic';

const AlterdataFullClient = dynamic(() => import('@/components/alterdata/AlterdataFullClient'), { ssr: false });

export const dynamic = 'force-dynamic';

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
