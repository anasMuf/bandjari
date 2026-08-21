import { createFileRoute } from '@tanstack/react-router'
import { DonateView } from '../../features/support/components/DonateView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/donasi')({
  head: ({ match }) =>
    seoMeta({
      title: 'Donasi | BandJari',
      description:
        'Dukung pengembangan BandJari — aplikasi penyusun & pemutar pola rebana Al-Banjari. Gratis, tanpa iklan; donasi membantu biaya server dan fitur baru.',
      pathname: match.pathname,
    }),
  component: DonateView,
})
