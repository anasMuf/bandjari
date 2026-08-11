import { useAuth } from '../../auth/AuthContext';

export function DashboardView() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h2>
      <p className="mt-1 text-sm text-gray-500">Welcome back, {user?.full_name}.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-900">Profile</h3>
          </div>
          <dl className="divide-y divide-gray-100 px-4">
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-gray-500">Username</dt>
              <dd className="font-medium text-gray-900">{user?.username}</dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{user?.email}</dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-900">{user?.phone}</dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-gray-500">Role</dt>
              <dd>
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-700/10 ring-inset">
                  {user?.role}
                </span>
              </dd>
            </div>
            <div className="flex justify-between py-3 text-sm">
              <dt className="text-gray-500">Address</dt>
              <dd className="font-medium text-gray-900 text-right max-w-[200px]">{user?.address}</dd>
            </div>
          </dl>
        </div>

        {/* Deposit Card */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-900">Current Balance</h3>
          </div>
          <div className="flex flex-col items-center justify-center px-4 py-10">
            <p className="text-4xl font-bold tracking-tight text-gray-900">
              ${user?.deposit?.toFixed(2) || '0.00'}
            </p>
            <p className="mt-2 text-sm text-gray-500">Deposit Balance</p>
          </div>
        </div>

        {/* Quick Info Card */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-900">Quick Info</h3>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-500">
              This is your starter kit dashboard. Extend it with more features as needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
