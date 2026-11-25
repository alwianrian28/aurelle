import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLocale, useLocalePath } from '../../hooks/useLocale';
import { signOut } from '../../lib/signOut';
import './Account.css';

/**
 * My Account (F-18): greeting, side navigation (sitemap §5.1) and the active page.
 */
export default function AccountLayout() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const locale = useLocale();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const links = [
    { id: 'overview', to: path('/account'), label: t('account.overview'), end: true },
    { id: 'orders', to: path('/account/orders'), label: t('account.orders') },
    { id: 'wishlist', to: path('/account/wishlist'), label: t('account.wishlist') },
    { id: 'addresses', to: path('/account/addresses'), label: t('account.addresses') },
    { id: 'profile', to: path('/account/profile'), label: t('account.profile') },
    { id: 'notifications', to: path('/account/notifications'), label: t('account.notifications') },
  ];
  const more = [
    { id: 'track', to: path('/track-order'), label: t('nav.track') },
    { id: 'help', to: path('/faq'), label: t('acct.helpCenter') },
  ];

  const handleLogout = () => {
    signOut();
    navigate(path('/store'));
  };

  const firstName = (user?.username ?? '').trim().split(/\s+/)[0];
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="account">
      <div className="container account__inner">
        <header className="account__head">
          <div>
            <p className="acct-label">{t('account.eyebrow')}</p>
            <h1>{t('account.greeting', { name: firstName })}</h1>
          </div>
          {memberSince && <p id="account-member-since">{t('acct.memberSince', { date: memberSince })}</p>}
        </header>

        <div className="account__layout">
          <nav className="account__nav" aria-label={t('account.eyebrow')}>
            <ul>
              {links.map((l) => (
                <li key={l.id}><NavLink id={`account-nav-${l.id}`} to={l.to} end={l.end}>{l.label}</NavLink></li>
              ))}
            </ul>
            <ul className="account__nav-more">
              {more.map((l) => (
                <li key={l.id}><NavLink id={`account-nav-${l.id}`} to={l.to}>{l.label}</NavLink></li>
              ))}
              <li><button type="button" onClick={handleLogout} id="account-logout">{t('common.logout')}</button></li>
            </ul>
          </nav>

          <section className="account__content">
            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}
