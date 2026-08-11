import { createFileRoute } from '@tanstack/react-router'
import { DashboardView } from '../../features/home/components/DashboardView'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardView,
})
