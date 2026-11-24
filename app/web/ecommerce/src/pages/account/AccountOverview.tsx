import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useAddressStore } from '../../store/addressStore';
import { useLocalePath } from '../../hooks/useLocale';
import { useMyOrders } from '../../hooks/useMyOrders';
import OrderRow from '../../components/OrderRow';
import EmailVerifyNotice from '../../components/EmailVerifyNotice';

/** My Account — Ringkasan. */
export default function AccountOverview() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const user = useAuthStore((s) => s.user);
  const wishlistCount = useWishlistStore((s) => s.productIds.length);
  const addressCount = useAddressStore((s) => s.addresses.length);
  const orders = useMyOrders();

  return (
    <>
      {user && !user.emailVerified && <EmailVerifyNotice />}

      <div className="account-stats">
        <NavLink to={path('/account/orders')} className="account-stat" id="stat-orders">
          <span className="account-stat__value">{orders.length}</span>
          <span className="account-stat__label">{t('account.orders')}</span>
        </NavLink>
        <NavLink to={path('/account/wishlist')} className="account-stat" id="stat-wishlist">
          <span className="account-stat__value">{wishlistCount}</span>
          <span className="account-stat__label">{t('account.wishlist')}</span>
        </NavLink>
        <NavLink to={path('/account/addresses')} className="account-stat" id="stat-addresses">
          <span className="account-stat__value">{addressCount}</span>
          <span className="account-stat__label">{t('account.addresses')}</span>
        </NavLink>
      </div>

      <div className="card account-panel">
        <div className="account-panel__head">
          <h2>{t('account.recentOrders')}</h2>
          {orders.length > 0 && (
            <NavLink to={path('/account/orders')} className="btn btn--ghost btn--sm">
              {t('common.seeAll')}
            </NavLink>
          )}
        </div>
        {orders.length === 0 ? (
          <div className="empty-state">
            <p>{t('account.noOrders')}</p>
            <NavLink to={path('/shop')} className="btn btn--outline btn--sm">
              {t('account.startShopping')}
            </NavLink>
          </div>
        ) : (
          <div className="order-list">
            {orders.slice(0, 3).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
