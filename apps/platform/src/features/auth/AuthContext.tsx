import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetUsers, getGetUsersQueryKey } from '../../api/endpoints/users/users';

export interface User {
  id: number;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  deposit: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Checks if a token exists in localStorage.
 * Used by route guards (beforeLoad) which run BEFORE React renders,
 * so we can't rely on React state there — only on localStorage directly.
 */
export function hasToken(): boolean {
  return !!localStorage.getItem('token');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const queryClient = useQueryClient();

  // Fetch user profile when token is available
  const { data: userResponse, isLoading, isError } = useGetUsers(
    { query: { enabled: !!token, retry: false, staleTime: 5 * 60 * 1000 } }
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    // Clear all React Query cache so stale user data doesn't persist
    queryClient.removeQueries({ queryKey: getGetUsersQueryKey() });
  }, [queryClient]);

  useEffect(() => {
    if (isError) {
      // Token expired or invalid — force logout
      logout();
    }
  }, [isError, logout]);

  const login = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
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
        isAuthenticated: !!token && !!user && !isError,
        isLoading: !!token && isLoading,
        user,
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
