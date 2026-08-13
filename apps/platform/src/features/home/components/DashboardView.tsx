import { useAuth } from '../../auth/AuthContext';

export function DashboardView() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h2>
      <p className="mt-1 text-sm text-gray-500">Selamat datang kembali, {user?.name}.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Profile Card */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-900">Profil</h3>
          </div>
          <dl className="divide-y divide-gray-100 px-4">
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-gray-500">Nama</dt>
              <dd className="font-medium text-gray-900">{user?.name}</dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{user?.email}</dd>
            </div>
          </dl>
        </div>

        {/* Quick Info Card */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-900">BandJari</h3>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-500">
              Bermain musik selayaknya sebuah band, cukup dengan jari.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
