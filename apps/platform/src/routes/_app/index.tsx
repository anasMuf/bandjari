import { createFileRoute } from '@tanstack/react-router'
import { HomeView } from '../../features/home/components/HomeView'
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/')({
  head: ({ match }) =>
    seoMeta({
      title: 'BandJari - Aplikasi Banjari, Buat Musik Banjari Online',
      description:
        'Susun pola pukulan rebana Al-Banjari (4 rebana + 1 bass) per section, dan mainkan live cukup dengan jari — gratis, tanpa login.',
      pathname: match.pathname,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        inLanguage: 'id-ID',
      },
    }),
  component: HomeView,
})
