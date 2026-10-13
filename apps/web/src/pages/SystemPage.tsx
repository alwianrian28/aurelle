import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../hooks/useLocale';

export type SystemKind = 'notFound' | 'error' | 'maintenance';

/** Halaman sistem §5.1: 404, 500, maintenance. Tidak diindeks mesin pencari. */
export default function SystemPage({ kind }: { kind: SystemKind }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const code = kind === 'notFound' ? '404' : kind === 'error' ? '500' : '503';
  const title = t(`system.${kind}Title`);

  return (
    <div className="container section" style={{ textAlign: 'center', minHeight: '60vh' }}>
      <title>{`${title} — Aurelle`}</title>
      <meta name="robots" content="noindex" />
      <p className="eyebrow" style={{ justifyContent: 'center' }}>{code}</p>
      <h1 className="heading-xl">{title}</h1>
      <p className="text-muted" style={{ marginTop: 'var(--space-3)' }}>{t(`system.${kind}Body`)}</p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
        {kind !== 'notFound' && (
          <button id="system-reload" type="button" className="btn btn--outline" onClick={() => window.location.reload()}>
            {t('system.reload')}
          </button>
        )}
        <NavLink id="system-home" to={path('/')} className="btn btn--primary">
          {t('system.backHome')}
        </NavLink>
      </div>
    </div>
  );
}
