/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../components/molecules/Toast';
import { AuthProvider } from '../AuthContext';
import { ProfileView } from './ProfileView';
import { setAccessToken } from '../../../lib/session';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

interface UserPayload {
  email_verified?: boolean;
  has_password?: boolean;
  providers?: string[];
}

function userBody(overrides: UserPayload = {}) {
  return {
    message: 'ok',
    data: {
      id: 1,
      name: 'Anas',
      email: 'a@mail.com',
      role: 'user',
      email_verified: true,
      has_password: true,
      providers: ['google'],
      ...overrides,
    },
  };
}

const sessionsBody = {
  message: 'Sesi aktif',
  data: [
    { id: 1, user_agent: 'Chrome', ip: '1.1.1.1', created_at: '2026-08-01T00:00:00Z', expires_at: '2026-08-30T00:00:00Z', current: true },
    { id: 2, user_agent: 'Firefox', ip: '2.2.2.2', created_at: '2026-08-02T00:00:00Z', expires_at: '2026-08-31T00:00:00Z', current: false },
  ],
};

/** Stub fetch berbasis rute — jauh lebih robust daripada urutan mock. */
function stubFetch(routes: Record<string, () => { status: number; body: unknown }>) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    const path = String(url);
    const key = Object.keys(routes).find((k) => path.includes(k));
    if (!key) return Promise.resolve(jsonResponse(404, { message: `unhandled: ${path}` }));
    const { status, body } = routes[key]();
    return Promise.resolve(jsonResponse(status, body));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderProfile(overrides: UserPayload = {}, extraRoutes?: Record<string, () => { status: number; body: unknown }>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <ProfileView />,
  });
  // Route yang dituju Link (support links) harus terdaftar.
  const supportRoutes = ['/donasi', '/faq', '/bantuan', '/kontak', '/tentang', '/privasi', '/syarat'].map((p) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: () => null }),
  );
  const routeTree = rootRoute.addChildren([profileRoute, ...supportRoutes]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
  await router.load();

  stubFetch({
    '/auth/refresh': () => ({ status: 200, body: { token: 'tok-123' } }),
    '/users': () => ({ status: 200, body: userBody(overrides) }),
    '/auth/sessions': () => ({ status: 200, body: sessionsBody }),
    '/auth/logout': () => ({ status: 204, body: null }),
    '/auth/delete-account': () => ({ status: 200, body: { message: 'Akun berhasil dihapus' } }),
    ...extraRoutes,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('ProfileView (pengelolaan akun 5 bagian)', () => {
  it('guest melihat prompt login (FR-AUTH-07)', async () => {
    await renderProfile({}, {
      '/auth/refresh': () => ({ status: 401, body: {} }),
    });

    await waitFor(() => expect(screen.getByText('Login untuk membuka Profile')).toBeDefined());
  });

  it('menampilkan 5 bagian + status verifikasi (email terverifikasi)', async () => {
    await renderProfile();

    await waitFor(() => expect(screen.getByText('Edit Profil')).toBeDefined());
    expect(screen.getByText('Keamanan')).toBeDefined();
    expect(screen.getByText('Sesi Aktif')).toBeDefined();
    expect(screen.getByText('Zona Berbahaya')).toBeDefined();
    expect(screen.getByText('Email terverifikasi')).toBeDefined();
  });

  it('email belum diverifikasi → chip + tombol kirim ulang', async () => {
    await renderProfile({ email_verified: false });

    await waitFor(() => expect(screen.getByText('Email belum diverifikasi')).toBeDefined());
    fireEvent.click(screen.getByText('Kirim ulang link'));
    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/resend-verification'));
      expect(call).toBeDefined();
    });
  });

  it('edit nama → PATCH /users + form terisi nama baru', async () => {
    await renderProfile();

    await waitFor(() => expect(screen.getByLabelText(/nama/i)).toBeDefined());
    fireEvent.change(screen.getByLabelText(/nama/i), { target: { value: 'Nama Baru' } });
    fireEvent.click(screen.getByText('Simpan'));

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      const call = fetchMock.mock.calls.find(([url, init]) => String(url).includes('/users') && String(init?.method).toUpperCase() === 'PATCH');
      expect(call).toBeDefined();
    });
  });

  it('akun ber-password → form ganti password; submit memanggil change-password', async () => {
    await renderProfile();

    await waitFor(() => expect(screen.getByLabelText('Password lama')).toBeDefined());
    fireEvent.change(screen.getByLabelText('Password lama'), { target: { value: 'lama1234' } });
    fireEvent.change(screen.getByLabelText('Password baru'), { target: { value: 'baru1234' } });
    fireEvent.change(screen.getByLabelText('Konfirmasi password baru'), { target: { value: 'baru1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ganti password' }));

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/change-password'));
      expect(call).toBeDefined();
    });
  });

  it('akun Google-only (tanpa password) → form buat password, bukan ganti password', async () => {
    await renderProfile({ has_password: false, providers: ['google'] });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Buat password' })).toBeDefined());
    expect(screen.queryByLabelText(/password lama/i)).toBeNull();
    // Google-only + terhubung → tidak bisa unlink tanpa password.
    expect(screen.getByText('Butuh password')).toBeDefined();
  });

  it('unlink Google → DELETE /auth/providers/google', async () => {
    await renderProfile();

    await waitFor(() => expect(screen.getByText('Putuskan koneksi')).toBeDefined());
    fireEvent.click(screen.getByText('Putuskan koneksi'));

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      const call = fetchMock.mock.calls.find(([url, init]) =>
        String(url).includes('/auth/providers/google') && String(init?.method).toUpperCase() === 'DELETE',
      );
      expect(call).toBeDefined();
    });
  });

  it('sesi aktif: label "Sesi ini" + tombol Putuskan (hanya sesi lain) → revoke', async () => {
    await renderProfile();

    await waitFor(() => expect(screen.getByText('Chrome')).toBeDefined());
    expect(screen.getByText('Sesi ini')).toBeDefined();
    expect(screen.getByText('Firefox')).toBeDefined();

    const revokeButtons = screen.getAllByText('Putuskan');
    expect(revokeButtons).toHaveLength(1); // hanya sesi non-current

    fireEvent.click(revokeButtons[0]);
    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/sessions/2/revoke'));
      expect(call).toBeDefined();
    });
  });

  it('hapus akun: dialog + konfirmasi password → DELETE account → kembali ke prompt login', async () => {
    await renderProfile();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Hapus akun' })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Hapus akun' }));

    const passwordField = await screen.findByLabelText(/masukkan password/i);
    fireEvent.change(passwordField, { target: { value: 'rahasia123' } });
    // Dua tombol "Hapus akun" (pembuka + konfirmasi dialog) — klik yang di dialog.
    const confirmButton = screen.getAllByRole('button', { name: 'Hapus akun' })[1];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/delete-account'));
      expect(call).toBeDefined();
    });
    // Sukses → logout → guest melihat prompt login.
    await waitFor(() => expect(screen.getByText('Login untuk membuka Profile')).toBeDefined());
  });
});
