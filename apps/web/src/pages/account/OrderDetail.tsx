import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale, useLocalePath, useLocalized } from '../../hooks/useLocale';
import { useMyOrders } from '../../hooks/useMyOrders';
import { useCountdown, formatDuration } from '../../hooks/useCountdown';
import { canPay } from '../../store/orderStore';
import { formatOrderMoney } from '../../utils/currency';
import { PaymentStatusPill, WorkStatusPill } from '../../components/StatusPill';
import SmartImage from '../../components/SmartImage';
import CostBreakdownList from '../../components/CostBreakdownList';

/**
 * F-18 Detail pesanan ready stock.
 * - Order milik pengguna lain → "tidak ditemukan" (FR-18-01, AC-18-01).
 * - Total = dibayar + sisa (FR-18-02, AC-18-02).
 * - Timeline memisahkan status pengerjaan & pembayaran (FR-18-03).
 * - Tombol Bayar hanya muncul jika valid (FR-18-04).
 */
export default function OrderDetail() {
  const { orderId } = useParams();
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const localized = useLocalized();
  const navigate = useNavigate();
  const orders = useMyOrders();
  const order = orders.find((o) => o.id === orderId);
  const remainingMs = useCountdown(order?.status === 'awaiting_payment' ? order.reservationExpiresAt : undefined);

  if (!order) {
    return (
      <div className="card account-panel empty-state">
        <p>{t('order.notFound')}</p>
        <NavLink to={path('/account/orders')} className="btn btn--outline btn--sm">
          {t('order.backToOrders')}
        </NavLink>
      </div>
    );
  }

  const money = (idr: number) => formatOrderMoney(idr, order, locale);
  const paidIdr = order.paymentStatus === 'paid' ? order.costs.total : 0;
  const remainingIdr = order.status === 'cancelled' ? 0 : order.costs.total - paidIdr;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const a = order.addressSnapshot;

  return (
    <>
      <NavLink to={path('/account/orders')} className="text-sm text-muted">
        ← {t('order.backToOrders')}
      </NavLink>

      <div className="card account-panel">
        <div className="account-panel__head" style={{ flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow">{t(`order.types.${order.type}`)}</p>
            <h2>{order.number}</h2>
            <p className="text-sm text-muted">{fmtDate(order.createdAt)}</p>
          </div>
          <div className="order-row__pills">
            <WorkStatusPill status={order.status} />
            <PaymentStatusPill status={order.paymentStatus} />
          </div>
        </div>

        {order.cancelReason && (
          <div className="alert alert--error" style={{ marginBottom: 'var(--space-5)' }}>
            {t(`order.cancelReason.${order.cancelReason}`)}
          </div>
        )}

        {canPay(order) && (
          <div
            className="alert alert--warning"
            style={{ marginBottom: 'var(--space-5)', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>{t('payment.timeLeft', { time: formatDuration(remainingMs) })}</span>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => navigate(path(`/checkout/payment/${order.id}`))}
              id="order-pay-now"
            >
              {t('order.payNow')}
            </button>
          </div>
        )}

        <div className="order-detail__grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <section>
              <h3 className="heading-md" style={{ marginBottom: 'var(--space-4)' }}>
                {t('order.items')}
              </h3>
              <ul className="order-items">
                {order.items.map((i) => (
                  <li key={i.variantId} className="order-item">
                    <div className="order-item__media">
                      <SmartImage src={i.image} alt="" category="ring" />
                    </div>
                    <div>
                      <p className="order-item__name">{localized(i.name)}</p>
                      <p className="text-sm text-muted">
                        {localized(i.variantLabel)} · ×{i.qty}
                      </p>
                    </div>
                    <span style={{ fontWeight: 600 }}>{money(i.unitPriceIdr * i.qty)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="heading-md" style={{ marginBottom: 'var(--space-4)' }}>
                {t('order.timeline')}
              </h3>
              <ol className="timeline">
                {order.history.map((h, idx) => (
                  <li key={idx} className="timeline__item">
                    <span className="text-muted">{fmtDate(h.at)}</span>
                    <span className="timeline__pills">
                      <WorkStatusPill status={h.status} />
                      <PaymentStatusPill status={h.paymentStatus} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <section className="card" style={{ padding: 'var(--space-5)' }}>
              <h3 className="heading-md" style={{ marginBottom: 'var(--space-4)' }}>
                {t('order.costs')}
              </h3>
              <CostBreakdownList costs={order.costs} format={money} />
              <dl className="dl-list" style={{ marginTop: 'var(--space-4)' }}>
                <div>
                  <dt>{t('order.paid')}</dt>
                  <dd>{money(paidIdr)}</dd>
                </div>
                <div>
                  <dt>{t('order.remaining')}</dt>
                  <dd>{money(remainingIdr)}</dd>
                </div>
                {order.lockedRate && (
                  <div>
                    <dt>{t('order.lockedRate')}</dt>
                    <dd>1 USD = Rp{order.lockedRate.usdToIdr.toLocaleString('id-ID')}</dd>
                  </div>
                )}
                <div>
                  <dt>{t('order.termsVersion')}</dt>
                  <dd>{order.termsVersion}</dd>
                </div>
              </dl>
              {order.paymentStatus === 'paid' && (
                <>
                  <button className="btn btn--outline btn--block btn--sm" style={{ marginTop: 'var(--space-5)' }} disabled>
                    {t('order.invoice')}
                  </button>
                  <p className="field-hint" style={{ marginTop: 'var(--space-2)' }}>
                    {t('order.invoiceNote')}
                  </p>
                </>
              )}
            </section>

            <section className="card" style={{ padding: 'var(--space-5)' }}>
              <h3 className="heading-md" style={{ marginBottom: 'var(--space-3)' }}>
                {t('order.shippingAddress')}
              </h3>
              <address className="text-sm" style={{ fontStyle: 'normal' }}>
                <strong>{a.recipient}</strong>
                <br />
                {a.phoneCountryCode} {a.phone}
                <br />
                {a.line1}
                {a.line2 && (
                  <>
                    <br />
                    {a.line2}
                  </>
                )}
                <br />
                {a.city}, {a.state} {a.postalCode}
                <br />
                {a.country}
              </address>
              <hr className="divider" style={{ margin: 'var(--space-4) 0' }} />
              <p className="text-sm">
                <span className="text-muted">{t('order.shippingService')}: </span>
                {order.shippingService.courier} — {localized(order.shippingService.name)}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
