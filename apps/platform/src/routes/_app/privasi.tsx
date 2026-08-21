import { createFileRoute } from '@tanstack/react-router'
import { LegalView } from '../../features/support/components/LegalView'
import { seoMeta } from '../../lib/seo'
import privasiMarkdown from '../../features/support/content/privasi.md?raw'

export const Route = createFileRoute('/_app/privasi')({
  head: ({ match }) =>
    seoMeta({
      title: 'Kebijakan Privasi | BandJari',
      description:
        'Kebijakan privasi BandJari — data apa yang dikumpulkan, bagaimana digunakan, dan hak Anda sebagai pengguna.',
      pathname: match.pathname,
    }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalView
      title="Kebijakan Privasi"
      subtitle="Bagaimana BandJari mengelola data Anda."
      markdown={privasiMarkdown}
    />
  )
}
