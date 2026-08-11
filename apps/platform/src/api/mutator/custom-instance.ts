const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

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

  const token = localStorage.getItem('token');

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

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
