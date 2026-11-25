import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../../hooks/useLocale';
import { api } from '../../lib/api';
import './Auth.css';

/** Editorial photo behind the brand panel. */
const AUTH_PHOTOS = {
  login: '/media/editorial/hero/necklace.webp',
  register: '/media/editorial/hero/ring.webp',
  recovery: '/media/editorial/hero/bracelet.webp',
} as const;

/**
 * Full-screen auth layout (no site header/footer): dark brand panel with an editorial photo
 * on the left, the form on the right. `back` chooses where the top link leads.
 */
export function AuthShell({ photo, sideTitle, side, back = 'shop', legal = true, title, children }: {
  photo: keyof typeof AUTH_PHOTOS;
  sideTitle: string;
  side: ReactNode;
  back?: 'shop' | 'login';
  /** Privacy/Terms links under the form (off where the form states them itself). */
  legal?: boolean;
  /** Document title. */
  title: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const path = useLocalePath();
  // These routes sit outside Layout, which normally keeps <html lang> in sync.
  useEffect(() => { document.documentElement.lang = i18n.language.startsWith('id') ? 'id' : 'en'; }, [i18n.language]);

  return (
    <div className="auth-shell">
      <title>{`${title} | Aurelle`}</title>
      <meta name="robots" content="noindex" />
      <aside className="auth-shell__side" style={{ backgroundImage: `url(${AUTH_PHOTOS[photo]})` }}>
        <NavLink to={path('/store')} className="auth-shell__logo" aria-label="Aurelle">AURELLE</NavLink>
        <div className="auth-shell__side-copy">
          <p className="auth-shell__side-title">{sideTitle}</p>
          {side}
        </div>
      </aside>
      <main id="main" className="auth-shell__main">
        <NavLink id="auth-back" className="auth-shell__back" to={path(back === 'shop' ? '/store' : '/auth/login')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H6M11 7l-5 5 5 5" /></svg>
          {t(back === 'shop' ? 'authPage.backShop' : 'authPage.backLogin')}
        </NavLink>
        <div className="auth-shell__content">{children}</div>
        {legal && <p className="auth-shell__legal">
          <NavLink to={path('/policies/privacy')}>{t('footer.privacy')}</NavLink>
          <span aria-hidden="true">·</span>
          <NavLink to={path('/policies/terms')}>{t('footer.terms')}</NavLink>
        </p>}
      </main>
    </div>
  );
}

/** Heading block shared by every auth view. */
export function AuthHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="auth-head">
      {eyebrow && <p className="auth-head__eyebrow">{eyebrow}</p>}
      <h1 className="auth-head__title">{title}</h1>
      {children && <p className="auth-head__body">{children}</p>}
    </header>
  );
}

/** Labelled input; `aside` sits on the label row (e.g. "Forgot password?"). */
export function AuthField({ label, error, hint, aside, ...input }: {
  label: string; error?: string; hint?: string; aside?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = input.id ?? auto;
  return (
    <div className="auth-field">
      <div className="auth-field__label"><label htmlFor={id}>{label}</label>{aside}</div>
      <input {...input} id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-note` : undefined} />
      {(error || hint) && <p id={`${id}-note`} className={error ? 'auth-field__error' : 'auth-field__hint'} role={error ? 'alert' : undefined}>{error ?? hint}</p>}
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField({ label, error, hint, aside, ...input }: {
  label: string; error?: string; hint?: string; aside?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useTranslation();
  const auto = useId();
  const id = input.id ?? auto;
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field">
      <div className="auth-field__label"><label htmlFor={id}>{label}</label>{aside}</div>
      <div className="auth-field__password">
        <input {...input} id={id} type={show ? 'text' : 'password'} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-note` : undefined} />
        <button type="button" id={`${id}-toggle`} aria-label={t(show ? 'authPage.hidePassword' : 'authPage.showPassword')} aria-pressed={show} onClick={() => setShow((v) => !v)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" />
            {show && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {(error || hint) && <p id={`${id}-note`} className={error ? 'auth-field__error' : 'auth-field__hint'} role={error ? 'alert' : undefined}>{error ?? hint}</p>}
    </div>
  );
}

/** Google Identity Services, loaded once and only when a sign-in page needs it. */
interface GoogleId {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: 'popup' }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}
let googleClientId: Promise<string | null> | undefined;
let googleScript: Promise<GoogleId> | undefined;
/** The OAuth client ID comes from the API (GOOGLE_CLIENT_ID in .env); null means Google sign-in is off. */
const loadGoogleClientId = () => (googleClientId ??= api<{ googleClientId: string | null }>('/auth/config').then((res) => (res.ok ? res.data.googleClientId : null)));
const loadGoogleScript = () => (googleScript ??= new Promise<GoogleId>((resolve, reject) => {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('gsi')));
  script.onerror = () => { googleScript = undefined; reject(new Error('gsi')); };
  document.head.appendChild(script);
}));

/**
 * "Continue with Google". When the API has a client ID, Google renders its own button here
 * (its sign-in popup only opens from a button it drew) and `onCredential` receives the ID
 * token for the API to verify. Otherwise our look-alike button stays and `onUnavailable`
 * lets the page say that Google sign-in is switched off.
 */
export function GoogleButton({ id, label, text, disabled, onCredential, onUnavailable }: {
  id: string; label: string; text: 'continue_with' | 'signup_with'; disabled?: boolean;
  onCredential: (credential: string) => void; onUnavailable: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  const [ready, setReady] = useState(false);
  useEffect(() => { handler.current = onCredential; });

  useEffect(() => {
    let live = true;
    void loadGoogleClientId().then(async (clientId) => {
      if (!clientId) return;
      const google = await loadGoogleScript();
      if (!live || !slot.current) return;
      google.initialize({ client_id: clientId, ux_mode: 'popup', callback: (response) => { if (response.credential) handler.current(response.credential); } });
      // Google accepts 200–400px; the auth column is at most 400px wide.
      google.renderButton(slot.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text, logo_alignment: 'center', locale: 'en', width: Math.max(200, Math.min(400, Math.round(slot.current.parentElement?.clientWidth ?? 400))) });
      setReady(true);
    }).catch(() => { /* blocked or offline: the fallback button below explains */ });
    return () => { live = false; };
  }, [text]);

  return (
    <div className={`auth-google-wrap${disabled ? ' is-disabled' : ''}`}>
      <div ref={slot} id={ready ? id : undefined} className="auth-google-slot" hidden={!ready} />
      {!ready && (
        <button type="button" id={id} className="auth-google" disabled={disabled} onClick={onUnavailable}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {label}
        </button>
      )}
    </div>
  );
}
