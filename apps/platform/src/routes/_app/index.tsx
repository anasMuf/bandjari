import { createFileRoute } from '@tanstack/react-router'
import { HomeView } from '../../features/home/components/HomeView'

export const Route = createFileRoute('/_app/')({
  component: HomeView,
})
