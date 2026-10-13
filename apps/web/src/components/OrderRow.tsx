import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Order } from '../types/domain';
import { useLocale, useLocalePath, useLocalized } from '../hooks/useLocale';
import { formatOrderMoney } from '../utils/currency';
import { PaymentStatusPill, WorkStatusPill } from './StatusPill';

/** Baris ringkas pesanan: tipe, status pengerjaan & pembayaran terpisah (F-18 alur utama). */
export default function OrderRow({ order }: { order: Order }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const localized = useLocalized();
  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);

  return (
    <NavLink to={path(`/account/orders/${order.id}`)} className="order-row" id={`order-row-${order.id}`}>
      <div className="order-row__main">
        <span className="order-row__number">{order.number}</span>
        <span className="text-muted text-sm">
          {new Date(order.createdAt).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
          · {t(`order.types.${order.type}`)} · {localized(order.items[0]?.name)}
          {itemCount > 1 ? ` +${itemCount - 1}` : ''}
        </span>
      </div>
      <div className="order-row__pills">
        <WorkStatusPill status={order.status} />
        <PaymentStatusPill status={order.paymentStatus} />
      </div>
      <span className="order-row__total">{formatOrderMoney(order.costs.total, order, locale)}</span>
      <span aria-hidden="true" className="text-muted">
        →
      </span>
    </NavLink>
  );
}
