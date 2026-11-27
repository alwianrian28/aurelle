import { useEffect, useState } from 'react';
import { api } from './api';
import Admin from './Admin';
import type { User } from './types';
import { Icon } from './ui';

/**
 * Staff dashboard shell: sign in, then the order and catalog desks. The dashboard has its own
 * sign-in and session cookie, separate from the shop's, so a customer account in the same
 * browser never signs the dashboard in (or out). Every admin endpoint checks the role again.
 */
export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void api<{ user: User | null }>('/admin/auth/me').then((res) => setUser(res.ok ? res.data.user : null)); }, []);

  const logout = async () => { setUser(null); await api('/admin/auth/logout', { method: 'POST' }); };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await api<{ user: User }>('/admin/auth/login', { body: { email, password } });
    setBusy(false);
    if (res.ok) { setPassword(''); setShowPassword(false); setUser(res.data.user); }
    // Generic on purpose: never reveals whether the email exists.
    else setError(
      res.status === 0 ? 'Could not reach the server.'
      : res.status === 429 ? 'Too many attempts. Try again in a moment.'
      : res.status === 401 ? 'Incorrect email or password.'
      : `The server could not sign you in right now (error ${res.status}). Try again in a moment.`,
    );
  };

  if (user === undefined) return <div className="login"><p style={{ color: '#555f6d' }}>Loading…</p></div>;
  if (user?.role === 'admin') return <Admin user={user} onUser={setUser} onLogout={() => void logout()} />;

  return (
    <div className="login">
      <form onSubmit={(e) => void login(e)}>
        <h1>AURELLE<small>Staff dashboard</small></h1>
        {user && <p role="alert">The account {user.email} does not have admin access. <button type="button" id="login-switch" style={{ height: 'auto', padding: 0, border: 0, background: 'none', color: '#151922', textDecoration: 'underline' }} onClick={() => void logout()}>Switch account</button></p>}
        <label>Email<input id="login-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} autoComplete="username" required /></label>
        <label>Password
          <span className="login__pw">
            <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" required />
            <button type="button" id="login-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} title={showPassword ? 'Hide password' : 'Show password'}>
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </span>
        </label>
        {error && <p role="alert">{error}</p>}
        <button id="login-submit" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
