import { createFileRoute } from '@tanstack/react-router'
import { SampleLibraryView } from '../../features/sample/components/SampleLibraryView'

export const Route = createFileRoute('/_app/project/samples')({
  component: SampleLibraryView,
})
