import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/domain';

/**
 * Autentikasi (mock) — F-01.
 * Implementasi nyata memakai Google Identity + email/password via backend Express.
 * Di sini hanya mensimulasikan sesi agar alur UI (login wajib sebelum checkout, BR-03)
 * dapat dibangun dan diuji lebih dulu.
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, _password: string) => Promise<{ ok: boolean; reason?: string }>;
  loginWithGoogle: () => Promise<{ ok: boolean }>;
  register: (email: string, username: string, _password: string) => Promise<{ ok: boolean }>;
  logout: () => void;
  /** Demo-only bypass untuk FR-01-03 — belum ada layanan email transaksional nyata. */
  verifyEmail: () => void;
  /** F-02: edit profil (username, telepon, newsletter). */
  updateProfile: (partial: Partial<Pick<User, 'username' | 'phoneCountryCode' | 'phone' | 'newsletter'>>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      loginWithEmail: async (email) => {
        // Mock: anggap berhasil jika email berformat valid (validasi penuh di backend nanti).
        if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, reason: 'invalid_email' };
        const mockUser: User = {
          id: 'u-mock-1',
          email,
          username: email.split('@')[0],
          emailVerified: true,
          provider: 'email',
          preferredLocale: 'id',
          preferredCurrency: 'IDR',
          newsletter: false,
        };
        set({ user: mockUser, isAuthenticated: true });
        return { ok: true };
      },
      loginWithGoogle: async () => {
        const mockUser: User = {
          id: 'u-mock-google-1',
          email: 'pelanggan@gmail.com',
          username: 'pelanggan',
          emailVerified: true,
          provider: 'google',
          preferredLocale: 'id',
          preferredCurrency: 'IDR',
          newsletter: false,
        };
        set({ user: mockUser, isAuthenticated: true });
        return { ok: true };
      },
      register: async (email, username) => {
        const mockUser: User = {
          id: 'u-mock-new',
          email,
          username,
          emailVerified: false, // FR-01-03: wajib verifikasi sebelum checkout
          provider: 'email',
          preferredLocale: 'id',
          preferredCurrency: 'IDR',
          newsletter: false,
        };
        set({ user: mockUser, isAuthenticated: true });
        return { ok: true };
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      verifyEmail: () =>
        set((state) => ({ user: state.user ? { ...state.user, emailVerified: true } : null })),
      updateProfile: (partial) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),
    }),
    { name: 'aurelle_auth' },
  ),
);
