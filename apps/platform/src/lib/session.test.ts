import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAccessToken,
  hasToken,
  logoutSession,
  notifySessionExpired,
  refreshSession,
  setAccessToken,
  subscribeAccessToken,
  subscribeSessionExpired,
} from './session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('session store (access token di memory)', () => {
  it('setAccessToken mengisi store & memberi sinyal ke subscriber', () => {
    const spy = vi.fn();
    const unsub = subscribeAccessToken(spy);

    expect(getAccessToken()).toBeNull();
    expect(hasToken()).toBe(false);

    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    expect(hasToken()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);

    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
    expect(hasToken()).toBe(false);

    unsub();
    setAccessToken('x');
    expect(spy).toHaveBeenCalledTimes(2); // unsubscribed — tidak bertambah
  });

  it('subscribeSessionExpired menerima notifikasi', () => {
    const spy = vi.fn();
    const unsub = subscribeSessionExpired(spy);
    notifySessionExpired();
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
    notifySessionExpired();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('refreshSession', () => {
  it('sukses → access token baru tersimpan', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('old-token');

    const token = await refreshSession();

    expect(token).toBe('new-token');
    expect(getAccessToken()).toBe('new-token');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${API_URL}/auth/refresh`),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('401 → token dibersihkan & mengembalikan null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    setAccessToken('old-token');

    const token = await refreshSession();

    expect(token).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('response tanpa token → null (tidak menyimpan undefined)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));
    const token = await refreshSession();
    expect(token).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe('logoutSession', () => {
  it('memanggil POST /auth/logout & membersihkan token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('abc');

    await logoutSession();

    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${API_URL}/auth/logout`),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('tetap membersihkan token walau request logout gagal (best-effort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    setAccessToken('abc');

    await logoutSession();

    expect(getAccessToken()).toBeNull();
  });
});
