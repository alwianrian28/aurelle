import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../../hooks/useLocale';
import { useMyOrders } from '../../hooks/useMyOrders';
import OrderRow from '../../components/OrderRow';

/** F-18 — daftar pesanan. Pesanan selesai/dibatalkan tetap terlihat (FR-18-06). */
export default function AccountOrders() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const orders = useMyOrders();

  return (
    <div className="card account-panel">
      <div className="account-panel__head">
        <h2>{t('account.orders')}</h2>
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
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
