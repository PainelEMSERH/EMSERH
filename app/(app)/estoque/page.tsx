'use client';
import dynamic from 'next/dynamic';
import '@/app/styles/vercel-theme.css';

const PageInner = dynamic(() => import('@/components/estoque/EstoquePage'), { ssr: false });

export default function Page() {
  return <div style={{ padding: '1rem' }}><PageInner /></div>;
}
