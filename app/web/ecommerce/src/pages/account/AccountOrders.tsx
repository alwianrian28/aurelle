import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale, useLocalePath, useLocalized } from '../../hooks/useLocale';
import { useMyOrders } from '../../hooks/useMyOrders';
import { canPay } from '../../store/orderStore';
import { formatOrderMoney } from '../../utils/currency';
import type { Order } from '../../types/domain';
import { OrderBadge, Thumb, TruckIcon, isOpenOrder, useShortDate } from './parts';

const FILTERS = ['all', 'progress', 'completed', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

const MATCH: Record<Filter, (order: Order) => boolean> = {
  all: () => true,
  progress: isOpenOrder,
  completed: (o) => o.status === 'delivered',
  cancelled: (o) => o.status === 'cancelled',
};

/** F-18 order list. Completed and cancelled orders stay visible (FR-18-06). */
export default function AccountOrders() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const orders = useMyOrders();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = orders.filter(MATCH[filter]);

  return (
    <>
      <header className="acct-title">
        <div>
          <h2>{t('account.orders')}</h2>
          <p>{t('acct.ordersCount', { count: orders.length })}</p>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="acct-card acct-empty">
          <p>{t('account.noOrders')}</p>
          <NavLink id="orders-shop" to={path('/shop')} className="guide-btn guide-btn--outline">{t('account.startShopping')}</NavLink>
        </div>
      ) : (
        <>
          <div className="acct-filters" role="group" aria-label={t('acct.filterLabel')}>
            {FILTERS.map((key) => {
              const count = orders.filter(MATCH[key]).length;
              return (
                <button key={key} id={`orders-filter-${key}`} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {t(`acct.filters.${key}`)}{count > 0 && ` (${count})`}
                </button>
              );
            })}
          </div>
          {shown.length === 0
            ? <div className="acct-card acct-empty"><p>{t('acct.noneInFilter')}</p></div>
            : shown.map((o) => <OrderCard key={o.id} order={o} />)}
        </>
      )}
    </>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const locale = useLocale();
  const text = useLocalized();
  const date = useShortDate();
  const money = (idr: number) => formatOrderMoney(idr, order, locale);
  const trackable = order.status === 'shipped' || order.status === 'ready_to_ship' || order.status === 'preparing';

  return (
    <article className="acct-card acct-order" id={`order-row-${order.id}`}>
      <header>
        <h3>{order.number}</h3>
        <span>{t('acct.placed', { date: date(order.createdAt, true) })}</span>
        <OrderBadge status={order.status} />
        <strong>{money(order.costs.total)}</strong>
      </header>
      <div className="acct-order__body">
        <ul>
          {order.items.map((item) => (
            <li key={item.variantId} className="acct-line">
              <Thumb src={item.image} />
              <div>
                <strong>{text(item.name)}</strong>
                <span>{t('acct.qty', { qty: item.qty, price: money(item.unitPriceIdr) })}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="acct-actions">
          {canPay(order) && <NavLink id={`order-pay-${order.id}`} className="guide-btn" to={path(`/checkout/payment/${order.id}`)}>{t('order.payNow')}</NavLink>}
          {trackable && (
            <NavLink id={`order-track-${order.id}`} className="guide-btn" to={`${path('/track-order')}?order=${encodeURIComponent(order.number)}`}><TruckIcon />{t('acct.trackShipment')}</NavLink>
          )}
          <NavLink id={`order-details-${order.id}`} className="guide-btn guide-btn--outline" to={path(`/account/orders/${order.id}`)}>{t('acct.details')}</NavLink>
        </div>
      </div>
    </article>
  );
}
