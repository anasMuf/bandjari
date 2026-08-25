import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../components/molecules/Toast';
import { Badge } from '../../../components/atoms/Badge';
import {
  useGetAuthSessions,
  usePostAuthSessionsIdRevoke,
  getGetAuthSessionsQueryKey,
} from '../../../api/endpoints/auth/auth';
import { ApiError } from '../../../api/mutator/custom-instance';

/** Sesi aktif dari GET /auth/sessions (E-PROFILE-2026 R9). */
interface SessionItem {
  id: number;
  user_agent?: string;
  ip?: string;
  created_at: string;
  expires_at: string;
  current?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Ekstrak array sesi dari respons DtoSuccessResponse yang bertipe unknown. */
function extractSessions(data: unknown): SessionItem[] {
  if (data && typeof data === 'object' && 'data' in data) {
    const inner = (data as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as SessionItem[];
  }
  return [];
}

/**
 * Bagian 4 — Sesi Aktif: daftar perangkat yang sedang login + tombol
 * "Putuskan" per sesi (E-PROFILE-2026 R9/R10). Sesi sekarang diberi label.
 */
export function SessionsCard() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const sessionsQuery = useGetAuthSessions({
    query: { retry: false, staleTime: 30_000 },
  });
  const sessions = sessionsQuery.isSuccess ? extractSessions(sessionsQuery.data.data) : [];

  const revokeMutation = usePostAuthSessionsIdRevoke({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAuthSessionsQueryKey() });
        addToast({ variant: 'success', title: 'Sesi diputuskan', message: 'Perangkat tersebut harus masuk ulang.' });
      },
      onError: (error: Error) => {
        addToast({
          variant: 'error',
          title: 'Gagal memutuskan sesi',
          message: error instanceof ApiError ? error.message : 'Terjadi kesalahan. Silakan coba lagi.',
        });
      },
    },
  });

  if (sessionsQuery.isLoading) {
    return <p className="text-sm text-stone-500">Memuat sesi aktif...</p>;
  }

  if (sessionsQuery.isError) {
    return (
      <p className="text-sm text-red-600">
        Gagal memuat sesi aktif — muat ulang halaman untuk mencoba lagi.
      </p>
    );
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-stone-500">Tidak ada sesi aktif lain.</p>;
  }

  return (
    <ul className="divide-y divide-stone-100">
      {sessions.map((session) => (
        <li key={session.id} className="flex items-center justify-between gap-3 px-1 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-stone-900">
                {session.user_agent || 'Perangkat tidak dikenal'}
              </p>
              {session.current && <Badge variant="system">Sesi ini</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              {session.ip ? `IP ${session.ip} · ` : ''}Mulai {formatDate(session.created_at)}
            </p>
          </div>
          {!session.current && (
            <button
              type="button"
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate({ id: session.id })}
              className="shrink-0 cursor-pointer text-sm font-semibold text-red-700 hover:text-red-600 disabled:opacity-50"
            >
              Putuskan
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
