import { useEffect } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canPay, useOrderStore } from '../../store/orderStore';
import { useMyOrders } from '../../hooks/useMyOrders';
import { useCountdown, formatDuration } from '../../hooks/useCountdown';
import { useLocale, useLocalePath } from '../../hooks/useLocale';
import { formatOrderMoney } from '../../utils/currency';
import CostBreakdownList from '../../components/CostBreakdownList';
import type { PaymentMethod } from '../../types/domain';
import './Checkout.css';

/**
 * Halaman pembayaran & hasil (§5.1: pending / sukses / gagal / expired).
 * Gateway nyata belum dipilih (OD-11); panel "simulasi" dipakai untuk menguji alur.
 * Status lunas hanya dari webhook — redirect sukses hanya menampilkan "menunggu konfirmasi" (AC-08-05).
 */
export default function Payment() {
  const { orderId } = useParams();
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const orders = useMyOrders();
  const { startPayment, handleGatewayRedirect, expireStale } = useOrderStore();
  const order = orders.find((o) => o.id === orderId);
  const remaining = useCountdown(order?.status === 'awaiting_payment' ? order.reservationExpiresAt : undefined);

  // Kedaluwarsakan reservasi saat waktu habis (AC-08-04).
  useEffect(() => {
    if (order?.status === 'awaiting_payment' && order.paymentStatus !== 'pending' && remaining === 0) expireStale();
  }, [remaining, order?.status, order?.paymentStatus, expireStale]);

  if (!order) {
    return (
      <div className="container section payment">
        <div className="card payment-card">
          <p>{t('order.notFound')}</p>
          <NavLink to={path('/account/orders')} className="btn btn--outline btn--sm">
            {t('order.backToOrders')}
          </NavLink>
        </div>
      </div>
    );
  }

  const money = (idr: number) => formatOrderMoney(idr, order, locale);
  const pay = (outcome: 'success' | 'failed', method: PaymentMethod = order.paymentMethod) => {
    startPayment(order.id, method);
    handleGatewayRedirect(order.id, outcome);
  };

  const state: 'paid' | 'pending' | 'expired' | 'failed' | 'awaiting' =
    order.paymentStatus === 'paid' || order.paymentStatus === 'review_finance'
      ? 'paid'
      : order.paymentStatus === 'pending'
        ? 'pending'
        : order.status === 'cancelled'
          ? 'expired'
          : order.paymentStatus === 'failed'
            ? 'failed'
            : 'awaiting';

  return (
    <div className="container section payment">
      <div className="card payment-card" aria-live="polite">
        {state === 'paid' && (
          <>
            <span className="payment-icon is-success" aria-hidden="true">
              ✓
            </span>
            <p className="eyebrow">{order.number}</p>
            <h1 className="heading-lg">{t('payment.successTitle')}</h1>
            <p className="text-muted">{t('payment.successBody', { number: order.number })}</p>
          </>
        )}

        {state === 'pending' && (
          <>
            <span className="payment-icon is-pending" aria-hidden="true">
              ◷
            </span>
            <p className="eyebrow">{order.number}</p>
            <h1 className="heading-lg">{t('payment.pendingTitle')}</h1>
            <p className="text-muted">{t('payment.pendingBody')}</p>
          </>
        )}

        {state === 'expired' && (
          <>
            <span className="payment-icon is-error" aria-hidden="true">
              ⌛
            </span>
            <p className="eyebrow">{order.number}</p>
            <h1 className="heading-lg">{t('payment.expiredTitle')}</h1>
            <p className="text-muted">{t('payment.expiredBody')}</p>
          </>
        )}

        {(state === 'awaiting' || state === 'failed') && (
          <>
            <span className={`payment-icon ${state === 'failed' ? 'is-error' : ''}`} aria-hidden="true">
              {state === 'failed' ? '!' : '◈'}
            </span>
            <p className="eyebrow">{order.number}</p>
            <h1 className="heading-lg">{state === 'failed' ? t('payment.failedTitle') : t('payment.gatewayTitle')}</h1>
            <p className="text-muted">{state === 'failed' ? t('payment.failedBody') : t('payment.gatewayBody')}</p>
            <p className="payment-countdown">{t('payment.timeLeft', { time: formatDuration(remaining) })}</p>

            {canPay(order) && (
              <div className="payment-gateway">
                <strong>
                  {order.paymentMethod === 'qris' ? t('checkout.qris') : t('checkout.card')} ·{' '}
                  {money(order.costs.total)}
                </strong>
                <div className="payment-gateway__actions">
                  <button className="btn btn--silver" onClick={() => pay('success')} id="pay-simulate-success">
                    {state === 'failed' ? t('payment.retry') : t('payment.simulateSuccess')}
                  </button>
                  <button className="btn btn--outline" onClick={() => pay('failed')} id="pay-simulate-fail">
                    {t('payment.simulateFail')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <CostBreakdownList costs={order.costs} format={money} />

        <div className="payment-actions">
          <NavLink to={path(`/account/orders/${order.id}`)} className="btn btn--primary btn--sm">
            {t('payment.viewOrder')}
          </NavLink>
          <NavLink to={path('/shop')} className="btn btn--ghost btn--sm">
            {t('payment.continueShopping')}
          </NavLink>
        </div>
      </div>
    </div>
  );
}
