import { createFileRoute } from '@tanstack/react-router'
import { ProfileView } from '../../features/auth/components/ProfileView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/profile')({
  head: ({ match }) =>
    seoMeta({
      title: 'Profil | BandJari',
      description: 'Kelola profil akun BandJari Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: ProfileView,
})
