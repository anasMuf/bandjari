import type { ReactNode } from 'react';
import { MobilePageHeader } from '../../../components/molecules/MobilePageHeader';
import { PageHeader } from '../../../components/molecules/PageHeader';

interface SupportPageLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * Layout halaman support (Donasi, FAQ, Bantuan, Kontak, Tentang, Legal):
 * MobilePageHeader di mobile + PageHeader di desktop, konsisten dengan
 * halaman lain di shell _app (pola ProfileView).
 */
export function SupportPageLayout({ title, subtitle, children }: SupportPageLayoutProps) {
  return (
    <div>
      <MobilePageHeader title={title} />
      <div className="max-sm:hidden">
        <PageHeader title={title} subtitle={subtitle} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
