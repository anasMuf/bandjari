import { Link } from '@tanstack/react-router';
import { SupportPageLayout } from './SupportPageLayout';
import { MarkdownCard, MarkdownContent } from './MarkdownContent';
import bantuanMarkdown from '../content/bantuan.md?raw';

/** Halaman Bantuan — panduan penggunaan produk (content/bantuan.md). */
export function HelpView() {
  return (
    <SupportPageLayout
      title="Bantuan"
      subtitle="Panduan langkah demi langkah — dari memulai hingga fitur lanjutan."
    >
      <MarkdownCard>
        <MarkdownContent markdown={bantuanMarkdown} />
      </MarkdownCard>

      <p className="mt-6 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
        Masih ada kendala? Cek{' '}
        <Link to="/faq" className="font-medium text-brand-700 hover:underline">
          FAQ
        </Link>{' '}
        atau sampaikan langsung via{' '}
        <Link to="/kontak" className="font-medium text-brand-700 hover:underline">
          Kontak
        </Link>
        .
      </p>
    </SupportPageLayout>
  );
}
