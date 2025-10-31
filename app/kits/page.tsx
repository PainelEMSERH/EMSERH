import AppShell from '@/components/layout/AppShell';
import KitsPage from '@/components/pages/KitsPage';

export default async function Page() {
  return (
    <AppShell title="Kits" breadcrumb={[{ label: 'Kits', href: '/kits' }]}>
      <KitsPage />
    </AppShell>
  );
}
