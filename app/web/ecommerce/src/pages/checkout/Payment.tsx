import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canPay, useOrderStore } from '../../store/orderStore';
import { useMyOrders } from '../../hooks/useMyOrders';
import { useCountdown, formatDuration } from '../../hooks/useCountdown';
import { useLocale, useLocalePath, useLocalized } from '../../hooks/useLocale';
import { formatOrderMoney } from '../../utils/currency';
import { loadPaymentConfig, payWithSnap, syncPayment, type PayResult } from '../../lib/payments';
import { BRAND_CONTACT, buildWhatsAppLink } from '../../config/brand';
import type { PaymentMethod } from '../../types/domain';
import './Checkout.css';

type View = 'paid' | 'review' | 'pending' | 'expired' | 'failed' | 'awaiting';

/**
 * Payment and its result (§5.1: awaiting / pending / paid / failed / expired).
 * Paying opens the Midtrans Snap popup. The page never marks an order paid itself: it shows
 * what the API reports, and the API hears it from Midtrans (AC-08-05, FR-08-09).
 * Without Midtrans keys (local development) a simulator stands in for the gateway.
 */
export default function Payment() {
  const { orderId } = useParams();
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const text = useLocalized();
  const location = useLocation();
  const orders = useMyOrders();
  const { startPayment, handleGatewayRedirect, expireStale } = useOrderStore();
  const order = orders.find((o) => o.id === orderId);
  const remaining = useCountdown(order?.status === 'awaiting_payment' ? order.reservationExpiresAt : undefined);

  const [gateway, setGateway] = useState<'loading' | 'midtrans' | 'demo'>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const autoOpened = useRef(false);

  useEffect(() => {
    let alive = true;
    void loadPaymentConfig().then((c) => { if (alive) setGateway(c.midtransClientKey ? 'midtrans' : 'demo'); });
    return () => { alive = false; };
  }, []);

  // Kedaluwarsakan reservasi saat waktu habis (AC-08-04).
  useEffect(() => {
    if (order?.status === 'awaiting_payment' && order.paymentStatus !== 'pending' && remaining === 0) expireStale();
  }, [remaining, order?.status, order?.paymentStatus, expireStale]);

  const id = order?.id;
  const waiting = order?.status === 'awaiting_payment';
  const pending = waiting && order?.paymentStatus === 'pending';

  // Coming back from Midtrans (redirect, or a reload): read the payment once on arrival.
  useEffect(() => {
    if (id && waiting && gateway === 'midtrans') void syncPayment(id);
  }, [id, waiting, gateway]);
  // While Midtrans still reports "pending", ask again every few seconds.
  useEffect(() => {
    if (!id || !pending || gateway !== 'midtrans') return;
    const timer = window.setInterval(() => void syncPayment(id), 5000);
    return () => window.clearInterval(timer);
  }, [id, pending, gateway]);

  const pay = async () => {
    if (!id || busy) return;
    setBusy(true);
    setNotice('');
    const result: PayResult = await payWithSnap(id);
    setBusy(false);
    if (result === 'network') setNotice(t('authPage.networkError'));
    else if (result === 'unavailable') setNotice(t('payment.unavailable'));
  };

  // Straight from checkout: open the payment popup without a second click.
  const fromCheckout = (location.state as { pay?: boolean } | null)?.pay === true;
  const payable = !!order && canPay(order);
  useEffect(() => {
    if (!fromCheckout || autoOpened.current || gateway !== 'midtrans' || !payable) return;
    autoOpened.current = true;
    void pay();
    // `pay` reads the latest state itself; this runs once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCheckout, gateway, payable]);

  if (!order) {
    return (
      <div className="pay">
        <div className="container pay__inner">
          <section className="pay-card">
            <h1>{t('order.notFound')}</h1>
            <div className="pay-card__links">
              <NavLink id="payment-orders" to={path('/account/orders')} className="guide-btn guide-btn--outline">{t('order.backToOrders')}</NavLink>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const money = (idr: number) => formatOrderMoney(idr, order, locale);
  const simulate = (outcome: 'success' | 'failed', method: PaymentMethod = order.paymentMethod) => {
    startPayment(order.id, method);
    handleGatewayRedirect(order.id, outcome);
  };

  const view: View =
    order.status === 'pending_decision' || order.paymentStatus === 'review_finance' ? 'review'
      : order.paymentStatus === 'paid' ? 'paid'
        : order.paymentStatus === 'pending' ? 'pending'
          : order.status === 'cancelled' ? 'expired'
            : order.paymentStatus === 'failed' ? 'failed'
              : 'awaiting';
  const methodLabel = order.paymentMethod === 'qris' ? t('checkout.qris') : t('checkout.cardTitle');
  const rows: [string, number][] = [
    [t('common.subtotal'), order.costs.subtotal],
    [t('checkout.shippingRow', { courier: order.shippingService.courier }), order.costs.shipping],
    [t('common.tax'), order.costs.tax],
    [t('common.duty'), order.costs.duty],
    [t('common.other'), order.costs.other],
  ];

  return (
    <div className="pay">
      <title>{`${t(`payment.title.${view}`)} | Aurelle`}</title>
      <div className="container pay__inner">
        <section className={`pay-card pay-card--${view}`} aria-live="polite">
          <span className="pay-card__icon" aria-hidden="true"><StatusIcon view={view} /></span>
          <p className="pay-card__number">{t('track.orderLabel', { number: order.number })}</p>
          <h1 id="payment-title">{t(`payment.title.${view}`)}</h1>
          <p className="pay-card__body">{t(`payment.body.${view}`, { number: order.number })}</p>

          {(view === 'awaiting' || view === 'failed') && payable && (
            <div className="pay-box">
              <dl>
                <div><dt>{t('payment.amount')}</dt><dd id="payment-amount">{money(order.costs.total)}</dd></div>
                <div><dt>{t('checkout.paymentMethod')}</dt><dd>{methodLabel}</dd></div>
                <div><dt>{t('payment.payWithin')}</dt><dd className="pay-box__time">{formatDuration(remaining)}</dd></div>
              </dl>

              {gateway === 'midtrans' && (
                <button id="payment-pay" type="button" className="guide-btn pay-box__cta" onClick={() => void pay()} disabled={busy}>
                  {busy ? t('payment.opening') : view === 'failed' ? t('payment.retry') : t('payment.payNow', { total: money(order.costs.total) })}
                </button>
              )}
              {gateway === 'demo' && (
                <div className="pay-box__demo">
                  <p>{t('payment.gatewayBody')}</p>
                  <div>
                    <button className="guide-btn" onClick={() => simulate('success')} id="pay-simulate-success">{view === 'failed' ? t('payment.retry') : t('payment.simulateSuccess')}</button>
                    <button className="guide-btn guide-btn--outline" onClick={() => simulate('failed')} id="pay-simulate-fail">{t('payment.simulateFail')}</button>
                  </div>
                </div>
              )}
              {notice && <p className="pay-box__notice" role="alert">{notice}</p>}
              {gateway === 'midtrans' && <p className="pay-box__secure"><LockIcon />{t('payment.secure')}</p>}
            </div>
          )}

          {view === 'pending' && (
            <button id="payment-check" type="button" className="pay-card__check" onClick={() => void syncPayment(order.id)}>{t('payment.checkAgain')}</button>
          )}

          <div className="pay-summary">
            <h2>{t('checkout.summary')}</h2>
            <ul>
              {order.items.map((item) => (
                <li key={item.variantId}>
                  <span>{text(item.name)} <small>{text(item.variantLabel)} · ×{item.qty}</small></span>
                  <span>{money(item.unitPriceIdr * item.qty)}</span>
                </li>
              ))}
            </ul>
            <dl>
              {rows.filter(([, value], index) => index < 2 || value > 0).map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>
              ))}
              <div className="is-total"><dt>{t('common.total')}</dt><dd>{money(order.costs.total)}</dd></div>
            </dl>
          </div>

          <div className="pay-card__links">
            {(view === 'paid' || view === 'review') && (
              <NavLink id="payment-track" to={`${path('/track-order')}?order=${encodeURIComponent(order.number)}`} className="guide-btn">{t('nav.track')}</NavLink>
            )}
            <NavLink id="payment-order" to={path(`/account/orders/${order.id}`)} className="guide-btn guide-btn--outline">{t('payment.viewOrder')}</NavLink>
            <NavLink id="payment-shop" to={path('/shop')} className="pay-card__text">{t('payment.continueShopping')}</NavLink>
          </div>
          {view !== 'paid' && !BRAND_CONTACT.isPlaceholder && (
            <p className="pay-card__help">
              {t('payment.needHelp')}{' '}
              <a id="payment-help" href={buildWhatsAppLink(t('track.helpMessage', { number: order.number }))} target="_blank" rel="noopener noreferrer">{t('help.chat')}</a>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

const SVG = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
function StatusIcon({ view }: { view: View }) {
  if (view === 'paid') return <svg {...SVG}><path d="M4.5 12.5l5 5 10-11" /></svg>;
  if (view === 'pending' || view === 'review') return <svg {...SVG}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
  if (view === 'expired' || view === 'failed') return <svg {...SVG}><path d="M12 7v6M12 16.5v.5" /><circle cx="12" cy="12" r="8.5" /></svg>;
  return <svg {...SVG}><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M3.5 10h17M7 14.5h3" /></svg>;
}
function LockIcon() {
  return <svg {...SVG} width={14} height={14} aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="1.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>;
}
