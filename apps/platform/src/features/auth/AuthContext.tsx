import { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetUsers, getGetUsersQueryKey } from '../../api/endpoints/auth/auth';
import {
  getAccessToken,
  setAccessToken,
  subscribeAccessToken,
  subscribeSessionExpired,
  refreshSession,
  logoutSession,
} from '../../lib/session';

export interface User {
  id: number;
  name: string;
  email: string;
  /** Role: "admin" | "user" — admin boleh mengelola System Template. */
  role?: string;
  /** true bila email sudah diverifikasi (E-AUTH-2026 R9) — dipakai banner. */
  email_verified?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  /** true bila user ber-role admin (FR-ROLE). */
  isAdmin: boolean;
  /** role opsional dari respons login — langsung dipakai sebelum profile selesai dimuat. */
  login: (token: string, role?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Cek sinkron apakah ada access token di memory. Access token TIDAK lagi di
 * localStorage (E-AUTH-2026 R4) — setelah F5 nilainya null; pemulihan session
 * dilakukan AuthProvider via refresh token di cookie httpOnly.
 */
export function hasToken(): boolean {
  return getAccessToken() !== null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Access token hidup di module store (memory) — sinkron ke React via
  // useSyncExternalStore. Tidak ada localStorage (gap #1 ditutup).
  const accessToken = useSyncExternalStore(subscribeAccessToken, getAccessToken);
  // Role dari respons login (optimistik) — ditimpa oleh role dari profile
  // begitu fetch /users selesai. Memory saja (bukan localStorage).
  const [roleOverride, setRoleOverride] = useState<string | null>(null);
  // true sampai pengecekan session awal selesai (refresh cookie saat F5).
  const [booting, setBooting] = useState(true);
  const queryClient = useQueryClient();

  // Boot: pulihkan session via cookie refresh; sekali jalan bersihkan
  // peninggalan localStorage dari versi lama (migrasi E-AUTH-2026).
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');

    let cancelled = false;
    (async () => {
      if (getAccessToken() === null) {
        // clearOnFailure:false — jangan hapus token yang terisi oleh login user
        // di tengah-tengah refresh (race saat boot).
        await refreshSession({ clearOnFailure: false });
      }
      if (!cancelled) setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch user profile ketika access token tersedia (setelah boot/login).
  const { data: userResponse, isLoading, isError } = useGetUsers(
    { query: { enabled: !!accessToken && !booting, retry: false, staleTime: 5 * 60 * 1000 } },
  );

  // Bersihkan state sesi: role override + cache user (access token dibersihkan
  // oleh session store / logoutSession).
  const clearSession = useCallback(() => {
    setRoleOverride(null);
    queryClient.removeQueries({ queryKey: getGetUsersQueryKey() });
  }, [queryClient]);

  // Sinyal dari customInstance: 401 tidak bisa dipulihkan (refresh gagal).
  useEffect(() => subscribeSessionExpired(clearSession), [clearSession]);

  // Backward-compat: isError pada query profile (mis. token invalid) → logout.
  useEffect(() => {
    if (isError) clearSession();
  }, [isError, clearSession]);

  const logout = useCallback(() => {
    // Revoke refresh token server-side + hapus cookie + clear access token.
    void logoutSession();
    clearSession();
  }, [clearSession]);

  const login = useCallback((newToken: string, newRole?: string) => {
    setAccessToken(newToken);
    if (newRole) {
      setRoleOverride(newRole);
    }
    // Invalidate the user query so it refetches with the new token
    queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
  }, [queryClient]);

  // Derive user from response
  const user: User | null = (() => {
    if (!userResponse?.data) return null;
    if ('data' in userResponse.data) {
      return userResponse.data.data as User;
    }
    return null;
  })();

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!accessToken && !!user && !isError,
        isLoading: booting || (!!accessToken && isLoading),
        user,
        // Profile (sumber utama) bila sudah dimuat; sebelum itu pakai role dari
        // respons login — UI admin langsung aktif setelah login.
        isAdmin: (user?.role ?? roleOverride) === 'admin',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
