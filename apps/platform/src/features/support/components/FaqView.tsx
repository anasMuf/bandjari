import { Link } from '@tanstack/react-router';
import { SupportPageLayout } from './SupportPageLayout';
import { FaqAccordion } from './FaqAccordion';
import faqMarkdown from '../content/faq.md?raw';

/** Halaman FAQ — akordeon dari content/faq.md (tiap `##` = satu pertanyaan). */
export function FaqView() {
  return (
    <SupportPageLayout
      title="FAQ"
      subtitle="Pertanyaan yang sering ditanyakan — jawaban singkat untuk memulai."
    >
      <FaqAccordion markdown={faqMarkdown} />

      <p className="mt-6 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
        Tidak menemukan jawabanmu? Lihat{' '}
        <Link to="/bantuan" className="font-medium text-brand-700 hover:underline">
          panduan Bantuan
        </Link>{' '}
        atau hubungi kami di{' '}
        <Link to="/kontak" className="font-medium text-brand-700 hover:underline">
          Kontak
        </Link>
        .
      </p>
    </SupportPageLayout>
  );
}
