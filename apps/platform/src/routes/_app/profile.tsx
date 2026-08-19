import { createFileRoute } from '@tanstack/react-router'
import { ProfileView } from '../../features/auth/components/ProfileView'

export const Route = createFileRoute('/_app/profile')({
  component: ProfileView,
})
