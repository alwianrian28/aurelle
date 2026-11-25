import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLocalePath } from '../hooks/useLocale';
import { signOutIntent } from '../lib/signOut';

/**
 * Guard rute yang memerlukan login (FR-01-04): checkout & My Account.
 * Pengguna dikembalikan ke halaman asal setelah login (FR-01-08, AC-01-01).
 * Catatan: ini hanya UX — pembatasan sesungguhnya ditegakkan di server (FR-18-01).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  const path = useLocalePath();

  if (!isAuthenticated) {
    // Logged out on purpose from a protected page: go to the store, not back to a login form.
    if (signOutIntent.active) return <Navigate to={path('/store')} replace />;
    return <Navigate to={path('/auth/login')} replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
