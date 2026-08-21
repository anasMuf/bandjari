import { createFileRoute } from '@tanstack/react-router'
import { HelpView } from '../../features/support/components/HelpView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/bantuan')({
  head: ({ match }) =>
    seoMeta({
      title: 'Bantuan | BandJari',
      description:
        'Panduan penggunaan BandJari — memulai, menyusun song & section, mengisi pola di sequencer, mengelola sample, dan memainkan live di launcher.',
      pathname: match.pathname,
    }),
  component: HelpView,
})
