import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLocalePath } from '../../hooks/useLocale';
import './Account.css';

/**
 * My Account (F-18) — kerangka navigasi sesuai sitemap §5.1.
 */
export default function AccountLayout() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const links = [
    { to: path('/account'), label: t('account.overview'), end: true },
    { to: path('/account/orders'), label: t('account.orders') },
    { to: path('/account/wishlist'), label: t('account.wishlist') },
    { to: path('/account/addresses'), label: t('account.addresses') },
    { to: path('/account/profile'), label: t('account.profile') },
    { to: path('/account/notifications'), label: t('account.notifications') },
  ];

  const handleLogout = () => {
    logout();
    navigate(path('/'));
  };

  return (
    <div className="container section account">
      <header className="account__head">
        <p className="eyebrow">{t('account.eyebrow')}</p>
        <h1 className="heading-xl">{t('account.greeting', { name: user?.username ?? '' })}</h1>
      </header>

      <div className="account__layout">
        <nav className="account__nav" aria-label={t('account.eyebrow')}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `account__link ${isActive ? 'is-active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
          <hr className="divider" />
          <button className="account__link account__logout" onClick={handleLogout} id="account-logout">
            {t('common.logout')}
          </button>
        </nav>

        <section className="account__content">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
