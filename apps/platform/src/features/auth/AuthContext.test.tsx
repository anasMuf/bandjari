/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import { setAccessToken } from '../../lib/session';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const userBody = { message: 'ok', data: { id: 1, name: 'Anas', email: 'a@mail.com', role: 'user' } };

function Harness() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="authed">{String(auth.isAuthenticated)}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="email">{auth.user?.email ?? ''}</span>
      <span data-testid="admin">{String(auth.isAdmin)}</span>
      <button type="button" onClick={() => auth.login('tok-123', 'user')}>login</button>
      <button type="button" onClick={() => auth.logout()}>logout</button>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function textOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? '';
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('AuthContext (token memory + boot session)', () => {
  it('boot dengan cookie valid → session pulih otomatis', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'fresh' })) // boot /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, userBody)); // /users
    vi.stubGlobal('fetch', fetchMock);

    renderAuth();

    await waitFor(() => expect(textOf('authed')).toBe('true'));
    expect(textOf('email')).toBe('a@mail.com');
  });

  it('boot tanpa cookie → guest (isAuthenticated false)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(401, {})); // boot /auth/refresh gagal
    vi.stubGlobal('fetch', fetchMock);

    renderAuth();

    await waitFor(() => expect(textOf('loading')).toBe('false'));
    expect(textOf('authed')).toBe('false');
  });

  it('login → set access token → profile dimuat', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {})) // boot: tidak ada session
      .mockResolvedValueOnce(jsonResponse(200, userBody)); // /users setelah login
    vi.stubGlobal('fetch', fetchMock);

    renderAuth();
    await waitFor(() => expect(textOf('authed')).toBe('false'));

    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(textOf('authed')).toBe('true'));
    expect(textOf('email')).toBe('a@mail.com');
  });

  it('logout → memanggil POST /auth/logout dan kembali guest', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'fresh' })) // boot refresh
      .mockResolvedValueOnce(jsonResponse(200, userBody)) // /users
      .mockResolvedValueOnce(jsonResponse(204, null)); // POST /auth/logout
    vi.stubGlobal('fetch', fetchMock);

    renderAuth();
    await waitFor(() => expect(textOf('authed')).toBe('true'));

    fireEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(textOf('authed')).toBe('false'));
    const logoutCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/auth/logout'),
    );
    expect(logoutCall).toBeDefined();
  });

  it('access token di memory hilang saat logout (bukan localStorage)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'fresh' }))
      .mockResolvedValueOnce(jsonResponse(200, userBody))
      .mockResolvedValueOnce(jsonResponse(204, null));
    vi.stubGlobal('fetch', fetchMock);

    renderAuth();
    await waitFor(() => expect(textOf('authed')).toBe('true'));
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('role')).toBeNull();

    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(textOf('authed')).toBe('false'));
    expect(localStorage.getItem('token')).toBeNull();
  });
});
