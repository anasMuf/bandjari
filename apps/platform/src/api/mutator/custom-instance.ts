import { getAccessToken, notifySessionExpired, refreshSession } from '../../lib/session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// Path /auth/* memakai cookie httpOnly sendiri — 401 di sini adalah kegagalan
// alur auth (mis. kredensial salah), BUKAN access token kedaluwarsa. Tidak
// boleh memicu auto-refresh atau notifikasi session expired.
const AUTH_FLOW_RE = /^\/auth\//;

// Single-flight: beberapa request 401 bersamaan cukup satu kali refresh,
// lalu semuanya retry dengan token baru.
let refreshInFlight: Promise<string | null> | null = null;

function tryRefreshOnce(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor({ status, message, code, details }: { status: number; message: string; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'UNKNOWN_ERROR';
    this.details = details;
  }
}

	export const customInstance = async <T>(
  urlStr: string,
  options?: RequestInit & { params?: Record<string, unknown> },
): Promise<T> => {
  const url = new URL(`${API_URL}${urlStr}`);
  
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Untuk FormData (upload file), biarkan browser menentukan Content-Type + boundary.
  const isFormData = options?.body instanceof FormData;

  const doRequest = (): Promise<Response> => {
    const token = getAccessToken();
    return fetch(url.toString(), {
      ...options,
      // Wajib untuk refresh token lintas-origin di cookie httpOnly (E-AUTH-2026 R5).
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  };

  let response = await doRequest();

  // Access token kedaluwarsa → refresh via cookie, retry sekali.
  if (response.status === 401 && !AUTH_FLOW_RE.test(urlStr) && getAccessToken()) {
    const newToken = await tryRefreshOnce();
    if (newToken) {
      response = await doRequest();
    } else {
      // Refresh gagal — session benar-benar mati. Beri sinyal agar UI logout.
      notifySessionExpired();
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      message: data?.message || `Request failed with status ${response.status}`,
      code: data?.code,
      details: data?.details,
    });
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as unknown as T;
};
