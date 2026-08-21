import { SupportPageLayout } from './SupportPageLayout';
import { MarkdownCard, MarkdownContent } from './MarkdownContent';
import tentangMarkdown from '../content/tentang.md?raw';

/** Halaman Tentang — profil produk & pengembang (content/tentang.md). */
export function AboutView() {
  return (
    <SupportPageLayout
      title="Tentang"
      subtitle="Cerita, fitur, dan teknologi di balik BandJari."
    >
      <MarkdownCard>
        <MarkdownContent markdown={tentangMarkdown} />
      </MarkdownCard>
    </SupportPageLayout>
  );
}
