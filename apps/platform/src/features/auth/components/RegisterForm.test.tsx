/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../components/molecules/Toast';
import { RegisterForm } from './RegisterForm';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function renderRegisterForm(onSuccess: () => void = () => {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RegisterForm onSuccess={onSuccess} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function submitValidForm() {
  fireEvent.change(screen.getByLabelText(/nama/i), { target: { value: 'Anas' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@mail.com' } });
  fireEvent.change(screen.getByLabelText(/kata sandi/i), { target: { value: 'password123' } });
  fireEvent.click(screen.getByText('Daftar'));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RegisterForm (pasca-register)', () => {
  it('setelah daftar sukses → layar cek email tampil + tombol kirim ulang dalam cooldown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(201, { message: 'ok', data: { id: 1 } })));

    renderRegisterForm();
    submitValidForm();

    await waitFor(() => expect(screen.getAllByText(/Akun berhasil dibuat/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/a@mail\.com/)).toBeDefined();
    expect(screen.getByText('Lanjut ke login')).toBeDefined();
    expect(screen.queryByLabelText(/kata sandi/i)).toBeNull();

    // Cooldown aktif sejak layar sukses (email sudah terkirim saat daftar):
    // tombol disabled dengan countdown.
    const resendBtn = screen.getByRole('button', { name: /Kirim ulang link/ }) as HTMLButtonElement;
    expect(resendBtn.disabled).toBe(true);
    expect(screen.getByText(/Kirim ulang link \(\d+s\)/)).toBeDefined(); // countdown
  });

  it('saat cooldown, klik tombol kirim ulang tidak memicu request (disabled)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(201, { message: 'ok', data: { id: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    renderRegisterForm();
    submitValidForm();
    await waitFor(() => expect(screen.getByRole('button', { name: /Kirim ulang link/ })).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Kirim ulang link/ }));

    const resendCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/auth/resend-verification'),
    );
    expect(resendCalls).toHaveLength(0);
  });

  it('Lanjut ke login → onSuccess dipanggil', async () => {
    const onSuccess = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(201, { message: 'ok', data: { id: 1 } })));

    renderRegisterForm(onSuccess);
    submitValidForm();
    await waitFor(() => expect(screen.getByText('Lanjut ke login')).toBeDefined());
    fireEvent.click(screen.getByText('Lanjut ke login'));

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
