import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../hooks/useLocale';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useWishlistStore } from '../store/wishlistStore';
import { products } from '../mocks/catalog';
import { useMyOrders } from '../hooks/useMyOrders';
import Icon from './ServiceIcons';
import { signOut } from '../lib/signOut';
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

  // Signed in: an icon that opens the account menu. Signed out: the labelled pill invites logging in.
  const account = isAuthenticated ? <AccountMenu /> : (
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

        <NavLink to={path('/store')} className="header__logo" aria-label="Aurelle, home">
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

/**
 * Account icon with a small menu: orders, tracking, wishlist, account details, log out.
 * Closes on Escape, on a click outside, and when a link in it is followed.
 */
function AccountMenu() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const orders = useMyOrders();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Same rule as the wishlist page: only pieces that are still on sale count.
  const wishCount = useWishlistStore((s) => s.productIds.filter((id) => products.some((p) => p.id === id && p.active)).length);
  const shipped = orders.filter((o) => o.status === 'shipped');
  // One parcel on the way: go straight to it. Otherwise the tracking page lists them.
  const trackTo = shipped.length === 1 ? `${path('/track-order')}?order=${encodeURIComponent(shipped[0].number)}` : path('/track-order');
  const firstName = (user?.username ?? '').trim().split(/\s+/)[0];
  const onAccount = location.pathname.startsWith('/account');
  const close = () => setOpen(false);

  const handleLogout = () => {
    close();
    signOut();
    navigate(path('/store'));
  };

  return (
    <div className="account-menu" ref={root}>
      <button
        id="header-account"
        ref={trigger}
        type="button"
        className={`header__icon-btn${open || onAccount ? ' is-active' : ''}`}
        aria-label={t('acct.menu.open')}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <UserIcon />
      </button>

      {/* Always rendered so it can fade and slide; `inert` keeps it out of reach while closed. */}
      <div id="account-menu" className={`account-menu__panel${open ? ' is-open' : ''}`} inert={!open}>
        <div className="account-menu__who">
          <strong>{t('acct.menu.hi', { name: firstName })}</strong>
          <span>{user?.email}</span>
        </div>
        <ul>
          <li>
            <NavLink id="account-menu-orders" to={path('/account/orders')} onClick={close}>
              <Icon name="orders" size={20} />{t('acct.menu.orders')}
              {orders.length > 0 && <em>{orders.length}</em>}
            </NavLink>
          </li>
          <li>
            <NavLink id="account-menu-track" to={trackTo} onClick={close}>
              <Icon name="track" size={22} />{t('acct.menu.track')}
              {shipped.length > 0 && <em title={t('acct.menu.onTheWay', { count: shipped.length })}>{shipped.length}</em>}
            </NavLink>
          </li>
          <li>
            <NavLink id="account-menu-wishlist" to={path('/account/wishlist')} onClick={close}>
              <HeartIcon />{t('account.wishlist')}
              {wishCount > 0 && <em>{wishCount}</em>}
            </NavLink>
          </li>
          <li><NavLink id="account-menu-details" to={path('/account')} end onClick={close}><UserIcon />{t('acct.menu.details')}</NavLink></li>
        </ul>
        <button id="account-menu-logout" type="button" className="account-menu__logout" onClick={handleLogout}><LogoutIcon />{t('common.logout')}</button>
      </div>
    </div>
  );
}

const LINE = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
function HeartIcon() {
  return <svg {...LINE}><path d="M12 20.5S3.5 15.3 3.5 9.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8.5 1.7c0 6-8.5 11.2-8.5 11.2z" /></svg>;
}
function LogoutIcon() {
  return <svg {...LINE}><path d="M10 4.5H5.5v15H10M15 8l-4 4 4 4M11 12h9" /></svg>;
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