import { useAuthStore } from '../store/authStore';

/**
 * True for a moment after the customer chooses "Log out". RequireAuth reads it so a deliberate
 * sign-out on a protected page lands on the store, while an expired session still goes to login.
 */
export const signOutIntent = { active: false };

/** Sign out on purpose. The caller then navigates to the store. */
export function signOut(): void {
  signOutIntent.active = true;
  void useAuthStore.getState().logout();
  window.setTimeout(() => { signOutIntent.active = false; }, 1500);
}
