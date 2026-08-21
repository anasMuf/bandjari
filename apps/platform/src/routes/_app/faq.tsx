import { createFileRoute } from '@tanstack/react-router'
import { FaqView } from '../../features/support/components/FaqView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/faq')({
  head: ({ match }) =>
    seoMeta({
      title: 'FAQ | BandJari',
      description:
        'Pertanyaan yang sering ditanyakan tentang BandJari — penggunaan, akun, sequencer, launcher, sample, dan template.',
      pathname: match.pathname,
    }),
  component: FaqView,
})
