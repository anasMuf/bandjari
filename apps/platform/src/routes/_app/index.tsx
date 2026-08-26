import { createFileRoute } from '@tanstack/react-router'
import { HomeView } from '../../features/home/components/HomeView'
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/')({
  head: ({ match }) =>
    seoMeta({
      title: 'BandJari - Aplikasi Banjari, Pemutar Banjari, Buat Musik Banjari',
      description:
        'Aplikasi banjari untuk buat musik banjari dan pemutar banjari. Susun pola rebana Al-Banjari, mainkan live cukup dengan jari - gratis.',
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
