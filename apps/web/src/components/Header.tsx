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
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.qty, 0));
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { to: path('/shop'), label: t('nav.shop') },
    { to: path('/collections'), label: t('nav.collections') },
    { to: path('/custom-po'), label: t('nav.customPo') },
    { to: path('/our-story'), label: t('nav.ourStory') },
    { to: path('/craftsmanship'), label: t('nav.craftsmanship') },
    { to: path('/contact'), label: t('nav.contact') },
  ];

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

          <NavLink id="header-account" aria-label={t('common.account')} to={isAuthenticated ? path('/account') : path('/auth/login')} className="header__account">
            <UserIcon />
            <span className="header__account-label">
              {t('common.account')}
            </span>
          </NavLink>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 8h12l1 12.5a1 1 0 01-1 1.1H6a1 1 0 01-1-1.1L6 8z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8V6a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" />
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