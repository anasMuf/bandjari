import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, customInstance } from './custom-instance';
import { getAccessToken, setAccessToken, subscribeSessionExpired } from '../../lib/session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface TestResponse {
  data: unknown;
  status: number;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('customInstance (access token memory + auto-refresh)', () => {
  it('menyertakan Authorization Bearer dari session store + credentials', async () => {
    setAccessToken('tok-123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await customInstance<TestResponse>('/users');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${API_URL}/users`),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      }),
    );
  });

  it('401 → refresh via cookie → retry sekali → sukses', async () => {
    setAccessToken('expired-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' })) // request /users
      .mockResolvedValueOnce(jsonResponse(200, { token: 'fresh-token' })) // POST /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { message: 'ok' })); // retry /users
    vi.stubGlobal('fetch', fetchMock);

    const res = await customInstance<TestResponse>('/users');

    expect(res.status).toBe(200);
    expect(getAccessToken()).toBe('fresh-token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('401 + refresh gagal → notify session expired + throw ApiError 401', async () => {
    const spy = vi.fn();
    const unsub = subscribeSessionExpired(spy);
    setAccessToken('expired-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'tidak ada cookie' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(customInstance('/users')).rejects.toMatchObject({ status: 401 });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    unsub();
  });

  it('401 pada /auth/login tidak memicu refresh (kredensial salah ≠ session expired)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, { message: 'Email atau password salah' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(customInstance('/auth/login')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // tanpa percobaan refresh
  });

  it('401 pada /auth/* tidak memicu refresh walau access token ada', async () => {
    setAccessToken('tok');
    const spy = vi.fn();
    const unsub = subscribeSessionExpired(spy);
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(401, { message: 'gagal' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(customInstance('/auth/refresh')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    unsub();
  });
});
