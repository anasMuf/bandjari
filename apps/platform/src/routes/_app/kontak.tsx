import { createFileRoute } from '@tanstack/react-router'
import { ContactView } from '../../features/support/components/ContactView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/kontak')({
  head: ({ match }) =>
    seoMeta({
      title: 'Kontak | BandJari',
      description:
        'Hubungi tim BandJari — pertanyaan, saran, atau laporan kendala melalui email atau WhatsApp.',
      pathname: match.pathname,
    }),
  component: ContactView,
})
