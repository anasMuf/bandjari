import { createFileRoute } from '@tanstack/react-router'
import { SampleLibraryView } from '../../features/sample/components/SampleLibraryView'
import { seoMeta } from '../../lib/seo'

export const Route = createFileRoute('/_app/project/samples')({
  head: ({ match }) =>
    seoMeta({
      title: 'Library Sample | BandJari',
      description: 'Kelola library sample suara rebana BandJari Anda.',
      pathname: match.pathname,
      noindex: true,
    }),
  component: SampleLibraryView,
})
