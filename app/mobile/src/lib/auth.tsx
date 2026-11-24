import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type User } from './api';

interface AuthValue {
  /** undefined while the saved session is being checked. */
  user: User | null | undefined;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Message for a failed auth call. Login errors stay generic (never reveal if an email exists). */
function message(status: number, error: string, retryAfterMs?: number): string {
  if (status === 0) return 'We can\'t reach the server. Please check your connection.';
  if (status === 429) return `Too many attempts. Try again in ${Math.ceil((retryAfterMs ?? 60_000) / 1000)} seconds.`;
  if (error === 'email_in_use') return 'An account with this email already exists. Please sign in.';
  if (error === 'invalid_input') return 'Please check your details (password must be at least 8 characters).';
  return 'Incorrect email or password.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    void api<{ user: User | null }>('/auth/me').then((res) => setUser(res.ok ? res.data.user : null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // keep: true -> a 30-day cookie, so the app stays signed in between launches.
    const res = await api<{ user: User }>('/auth/login', { body: { email, password, keep: true } });
    if (!res.ok) return message(res.status, res.error, res.retryAfterMs);
    setUser(res.data.user);
    return null;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api<{ user: User }>('/auth/register', { body: { email, username: name, password } });
    if (!res.ok) return message(res.status, res.error);
    setUser(res.data.user);
    return null;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await api('/auth/logout', { method: 'POST' });
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
