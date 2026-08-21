import { SupportPageLayout } from './SupportPageLayout';
import { MarkdownCard, MarkdownContent } from './MarkdownContent';

interface LegalViewProps {
  title: string;
  subtitle: string;
  markdown: string;
}

/** Halaman legal bersama (Kebijakan Privasi / Syarat & Ketentuan). */
export function LegalView({ title, subtitle, markdown }: LegalViewProps) {
  return (
    <SupportPageLayout title={title} subtitle={subtitle}>
      <MarkdownCard>
        <MarkdownContent markdown={markdown} />
      </MarkdownCard>
    </SupportPageLayout>
  );
}
