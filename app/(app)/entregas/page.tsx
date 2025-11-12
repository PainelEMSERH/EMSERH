'use client';

import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swr';
import dynamic from 'next/dynamic';
import '@/app/styles/vercel-theme.css';

const Table = dynamic(() => import('@/components/entregas/EntregasTable'), { ssr: false });

export default function Page() {
  return (
    <SWRConfig value={swrConfig}>
      <div style={{ padding: '1rem' }}>
        <Table initialPageSize={50} />
      </div>
    </SWRConfig>
  );
}
