import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../hooks/useLocale';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import './Header.css';

/**
 * Header global — §5.1: logo, navigasi utama, pencarian,
 * akun dan keranjang.
 */
export default function Header() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  // Number of different pieces in the bag, not the total quantity.
  const cartCount = useCartStore((s) => s.items.length);
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { to: path('/shop'), label: t('nav.shop') },
    { to: path('/collections'), label: t('nav.collections') },
    { to: path('/our-story'), label: t('nav.ourStory') },
    { to: path('/contact'), label: t('nav.contact') },
  ];

  // Signed in: a plain icon like search and bag. Signed out: the labelled pill invites logging in.
  const account = isAuthenticated ? (
            <NavLink id="header-account" aria-label={t('common.account')} title={t('common.account')} to={path('/account')} className={({ isActive }) => `header__icon-btn${isActive ? ' is-active' : ''}`}>
              <UserIcon />
            </NavLink>
          ) : (
            <NavLink id="header-account" aria-label={t('common.account')} to={path('/auth/login')} className="header__account">
              <UserIcon />
              <span className="header__account-label">
                {t('common.account')}
              </span>
            </NavLink>
  );

  return (
    <header className="header">
      <div className="header__bar container">
        <button
          id="header-menu"
          className="header__burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <NavLink to={path('/store')} className="header__logo" aria-label="Aurelle — Home">
          <img src="/favicon.svg" width="30" height="30" alt="" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />AURELLE
        </NavLink>

        <nav className={`header__nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navigasi utama">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `header__link ${isActive ? 'is-active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header__actions">
          <button id="header-search" className="header__icon-btn" aria-label={t('common.search')} onClick={() => navigate(path('/search'))}>
            <SearchIcon />
          </button>

          <NavLink id="header-cart" to={path('/cart')} className="header__icon-btn" aria-label={t('common.cart')}>
            <BagIcon />
            {cartCount > 0 && <span className="header__badge">{cartCount}</span>}
          </NavLink>

          {account}
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
/** Same 18px box and 1.5px stroke as the search and account icons. */
function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 8.5h13l1.1 12.5H4.4z" />
      <path d="M8.8 8.5V7a3.2 3.2 0 0 1 6.4 0v1.5" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 20c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}