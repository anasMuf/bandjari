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
import { LoginForm } from './LoginForm';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <LoginForm onSuccess={() => {}} />,
  });
  // Route yang dituju Link di dalam LoginForm harus terdaftar.
  const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: () => null });
  const forgotRoute = createRoute({ getParentRoute: () => rootRoute, path: '/forgot-password', component: () => null });
  const routeTree = rootRoute.addChildren([indexRoute, registerRoute, forgotRoute]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
  await router.load();

  // Urutan provider sama seperti produksi (main.tsx): router DI DALAM providers.
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
});

describe('LoginForm (email-first)', () => {
  it('email akun Google → tombol Masuk dengan Google (tanpa form password)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {})) // boot refresh (guest)
      .mockResolvedValueOnce(jsonResponse(200, { method: 'google' })); // check-email
    vi.stubGlobal('fetch', fetchMock);

    await renderLoginForm();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'google@mail.com' } });
    fireEvent.click(screen.getByText('Lanjut'));

    await waitFor(() => expect(screen.getByText('Akun ini menggunakan Google')).toBeDefined());
    expect(screen.getByText('Masuk dengan Google')).toBeDefined();
    expect(screen.queryByLabelText(/kata sandi/i)).toBeNull();
  });

  it('email akun password → form password muncul', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {})) // boot refresh
      .mockResolvedValueOnce(jsonResponse(200, { method: 'password' })); // check-email
    vi.stubGlobal('fetch', fetchMock);

    await renderLoginForm();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'pw@mail.com' } });
    fireEvent.click(screen.getByText('Lanjut'));

    await waitFor(() => expect(screen.getByLabelText(/kata sandi/i)).toBeDefined());
    expect(screen.getByText('Lupa password?')).toBeDefined();
  });

  it('email tidak terdaftar → tawarkan daftar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {})) // boot refresh
      .mockResolvedValueOnce(jsonResponse(200, { method: 'none' })); // check-email
    vi.stubGlobal('fetch', fetchMock);

    await renderLoginForm();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'baru@mail.com' } });
    fireEvent.click(screen.getByText('Lanjut'));

    await waitFor(() => expect(screen.getByText('Email belum terdaftar')).toBeDefined());
    expect(screen.getByText('Daftar dengan email ini')).toBeDefined();
    expect(screen.getByText('Masuk dengan Google')).toBeDefined();
  });
});
