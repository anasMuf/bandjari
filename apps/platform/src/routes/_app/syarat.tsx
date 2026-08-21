import { createFileRoute } from '@tanstack/react-router'
import { LegalView } from '../../features/support/components/LegalView'
import { seoMeta } from '../../lib/seo'
import syaratMarkdown from '../../features/support/content/syarat.md?raw'

export const Route = createFileRoute('/_app/syarat')({
  head: ({ match }) =>
    seoMeta({
      title: 'Syarat & Ketentuan | BandJari',
      description:
        'Syarat & ketentuan penggunaan BandJari — aplikasi penyusun & pemutar pola rebana Al-Banjari.',
      pathname: match.pathname,
    }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalView
      title="Syarat & Ketentuan"
      subtitle="Aturan penggunaan layanan BandJari."
      markdown={syaratMarkdown}
    />
  )
}
