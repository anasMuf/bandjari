import { createFileRoute } from '@tanstack/react-router'
import { AboutView } from '../../features/support/components/AboutView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/tentang')({
  head: ({ match }) =>
    seoMeta({
      title: 'Tentang | BandJari',
      description:
        'Tentang BandJari — aplikasi web penyusun & pemutar pola pukulan rebana Al-Banjari: fitur utama, teknologi, dan pengembang.',
      pathname: match.pathname,
    }),
  component: AboutView,
})
