import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/domain';
import { api } from '../lib/api';

/**
 * Autentikasi — F-01, lewat API (FastAPI). Sesi disimpan server di cookie httpOnly;
 * `user` di sini hanya cermin untuk UI (dipersist agar tidak berkedip saat muat ulang) dan
 * disegarkan dari `/auth/me` saat aplikasi dibuka. Pembatasan akses ditegakkan di server.
 */
export type TokenResult = 'ok' | 'invalid' | 'expired' | 'used';
type Failure = { ok: false; reason: 'invalid' | 'throttled' | 'email_in_use' | 'network'; retryAfterMs?: number };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** Samakan dengan sesi server (dipanggil sekali saat aplikasi dibuka). */
  refresh: () => Promise<void>;
  loginWithEmail: (email: string, password: string, keep?: boolean) => Promise<{ ok: true } | Failure>;
  register: (email: string, username: string, password: string, newsletter?: boolean) => Promise<{ ok: true; devToken?: string } | Failure>;
  logout: () => Promise<void>;
  verifyEmail: (token: string | null) => Promise<TokenResult>;
  resendVerification: () => Promise<{ ok: boolean; devToken?: string; retryAfterMs?: number }>;
  /** F-02: edit profil (nama, telepon, newsletter). Optimistis; server memvalidasi ulang. */
  updateProfile: (partial: Partial<Pick<User, 'username' | 'phoneCountryCode' | 'phone' | 'newsletter'>>) => void;
}

const failure = (status: number, error: string, data?: Record<string, unknown>): Failure => ({
  ok: false,
  reason: status === 0 ? 'network' : status === 429 ? 'throttled' : error === 'email_in_use' ? 'email_in_use' : 'invalid',
  retryAfterMs: typeof data?.retryAfterMs === 'number' ? data.retryAfterMs : undefined,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      refresh: async () => {
        const res = await api<{ user: User | null }>('/auth/me');
        // Offline: keep the mirrored user so the UI stays usable; the server still gates data.
        if (res.ok) set({ user: res.data.user, isAuthenticated: !!res.data.user });
      },

      loginWithEmail: async (email, password, keep = false) => {
        const res = await api<{ user: User }>('/auth/login', { body: { email, password, keep } });
        if (!res.ok) return failure(res.status, res.error, res.data);
        set({ user: res.data.user, isAuthenticated: true });
        return { ok: true };
      },

      register: async (email, username, password, newsletter = false) => {
        const res = await api<{ user: User; devToken?: string }>('/auth/register', { body: { email, username, password, newsletter } });
        if (!res.ok) return failure(res.status, res.error, res.data);
        set({ user: res.data.user, isAuthenticated: true });
        return { ok: true, devToken: res.data.devToken };
      },

      logout: async () => {
        set({ user: null, isAuthenticated: false });
        await api('/auth/logout', { method: 'POST' });
      },

      verifyEmail: async (token) => {
        if (!token) return 'invalid';
        const res = await api<{ result: TokenResult }>('/auth/verify', { body: { token } });
        if (!res.ok) return 'invalid';
        if (res.data.result === 'ok') await get().refresh();
        return res.data.result;
      },

      resendVerification: async () => {
        const res = await api<{ devToken?: string }>('/auth/verify/resend', { method: 'POST' });
        if (res.ok) return { ok: true, devToken: res.data.devToken };
        return { ok: false, retryAfterMs: typeof res.data?.retryAfterMs === 'number' ? res.data.retryAfterMs : undefined };
      },

      updateProfile: (partial) => {
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : null }));
        void api<{ user: User }>('/auth/profile', { method: 'PATCH', body: { ...partial, ...('phone' in partial ? { phone: partial.phone ?? '' } : {}), ...('phoneCountryCode' in partial ? { phoneCountryCode: partial.phone ? partial.phoneCountryCode ?? '' : '' } : {}) } })
          .then((res) => { if (res.ok) set({ user: res.data.user }); });
      },
    }),
    { name: 'aurelle_auth' },
  ),
);
