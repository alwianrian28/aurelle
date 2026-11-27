import { useState, type FormEvent } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale, useLocalePath, useLocalized } from '../hooks/useLocale';
import { useMyOrders } from '../hooks/useMyOrders';
import { useCourierTracking } from '../hooks/useCourierTracking';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { ScrollSmoother } from '../lib/gsap';
import { BRAND_CONTACT, buildWhatsAppLink } from '../config/brand';
import type { Order, OrderTracking, ReadyStockOrderStatus, TrackedOrder } from '../types/domain';
import Icon from '../components/ServiceIcons';
import SmartImage from '../components/SmartImage';
import ShipmentJourney from '../components/ShipmentJourney';
import './TrackOrder.css';

const STEPS = ['placed', 'paid', 'preparing', 'shipped', 'delivered'] as const;
/** How far along the five steps each order status is. */
const STEP_OF: Record<ReadyStockOrderStatus, number> = {
  awaiting_payment: 0,
  pending_decision: 0,
  confirmed: 1,
  preparing: 2,
  ready_to_ship: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 0,
};

/** A signed-in customer's own order, reduced to what this page shows. `live` is the courier's
 * scans, driver and map, once they have been read (useCourierTracking). */
function fromOwnOrder(order: Order, live: OrderTracking | null): TrackedOrder {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    cancelReason: order.cancelReason,
    history: order.history,
    tracking: live ?? order.tracking,
    items: order.items,
    shippingService: order.shippingService,
    destination: { city: order.addressSnapshot.city, country: order.addressSnapshot.country },
  };
}

/**
 * Track order: where a parcel is, without opening the account pages.
 * - Signed in: pick one of your own orders.
 * - Anyone: order number + the email it was placed with (POST /orders/track). The API answers
 *   with shipment status only, never the address, phone or prices.
 */
export default function TrackOrder() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const locale = useLocale();
  const text = useLocalized();
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const myOrders = useMyOrders();

  const [number, setNumber] = useState(params.get('order') ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [looked, setLooked] = useState<TrackedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  // An own order is read from the synced store, so it stays current; a looked-up one is a snapshot.
  const picked = params.get('order');
  const own = picked ? myOrders.find((o) => o.number === picked) : undefined;
  // Once a courier is booked, its scans and the map are read for the picked order.
  const live = useCourierTracking(own?.tracking?.status ? own.id : undefined, own?.tracking?.updatedAt);
  const order = own ? fromOwnOrder(own, live) : looked;

  const show = (orderNumber: string | null) => {
    setParams(orderNumber ? { order: orderNumber } : {}, { replace: true, preventScrollReset: true });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const wanted = number.trim().toUpperCase();
    if (!wanted || !email.trim() || busy) return;
    setBusy(true);
    setError('');
    const res = await api<{ order: TrackedOrder }>('/orders/track', { body: { number: wanted, email: email.trim() } });
    setBusy(false);
    if (res.ok) {
      setLooked(res.data.order);
      show(myOrders.some((o) => o.number === res.data.order.number) ? res.data.order.number : null);
      // On one-column layouts the result sits below the form: bring it into view.
      if (window.matchMedia('(max-width: 900px)').matches) {
        requestAnimationFrame(() => {
          const target = document.getElementById('track-main');
          if (!target) return;
          const smoother = ScrollSmoother.get();
          if (smoother) smoother.scrollTo(target, true, 'top 90px');
          else target.scrollIntoView({ behavior: 'smooth' });
        });
      }
      return;
    }
    setLooked(null);
    show(null);
    setError(t(res.status === 429 ? 'track.tooMany' : res.status === 0 ? 'authPage.networkError' : 'track.notFound'));
  };

  const reset = () => {
    setLooked(null);
    setError('');
    setNumber('');
    show(null);
  };

  const fmtDate = (iso: string, withTime = true) =>
    new Date(iso).toLocaleString(locale === 'id' ? 'id-ID' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });

  const copyAwb = async (awb: string) => {
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the number stays selectable */ }
  };

  return (
    <article className="track">
      <title>{`${t('track.title')} | Aurelle`}</title>
      <meta name="description" content={t('track.intro')} />

      <div className="container track__inner">
        <header className="track__head">
          <h1>{t('track.title')}</h1>
          <p>{t('track.intro')}</p>
        </header>

        <div className="track__grid">
          <aside className="track__side">
            <form className="track-form" onSubmit={submit} noValidate aria-labelledby="track-form-title">
              <h2 id="track-form-title">{t('track.formTitle')}</h2>
              <div className="track-form__field">
                <label htmlFor="track-number">{t('track.number')}</label>
                <input id="track-number" type="text" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="AUR-RS-000000-0000" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={30} required />
                <p>{t('track.numberHint')}</p>
              </div>
              <div className="track-form__field">
                <label htmlFor="track-email">{t('track.email')}</label>
                <input id="track-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" maxLength={254} required />
              </div>
              {error && <p id="track-error" className="track-form__error" role="alert">{error}</p>}
              <button id="track-submit" type="submit" className="guide-btn" disabled={busy || !number.trim() || !email.trim()}>
                {busy ? t('track.searching') : t('track.submit')}
              </button>
            </form>

            {user ? (
              <section className="track-mine" aria-labelledby="track-mine-title">
                <h2 id="track-mine-title" className="track__label">{t('track.yourOrders')}</h2>
                {myOrders.length === 0 ? <p>{t('track.yourOrdersEmpty')}</p> : (
                  <ul>
                    {myOrders.slice(0, 5).map((o) => (
                      <li key={o.id}>
                        <button id={`track-pick-${o.id}`} type="button" aria-pressed={order?.number === o.number} onClick={() => { setError(''); setLooked(null); show(o.number); }}>
                          <span><strong>{o.number}</strong><small>{fmtDate(o.createdAt, false)}</small></span>
                          <span>{t(`order.status.${o.status}`)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <p className="track__hint">
                {t('track.loginHint')}{' '}
                <NavLink id="track-login" to={path('/auth/login')} state={{ from: path('/track-order') }}>{t('common.login')}</NavLink>
              </p>
            )}
          </aside>

          <div id="track-main" className="track__main" aria-live="polite">
            {!order ? (
              <section className="track-empty">
                <h2>{t('track.emptyTitle')}</h2>
                <p>{t('track.emptyBody')}</p>
                <ol>
                  {STEPS.map((step, index) => <li key={step}><span>{index + 1}</span>{t(`track.steps.${step}`)}</li>)}
                </ol>
              </section>
            ) : (
              <Result
                order={order}
                fmtDate={fmtDate}
                copied={copied}
                onCopy={copyAwb}
                onReset={reset}
                detailPath={order.id ? path(`/account/orders/${order.id}`) : null}
                contactPath={path('/contact')}
                text={text}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Result({ order, fmtDate, copied, onCopy, onReset, detailPath, contactPath, text }: {
  order: TrackedOrder;
  fmtDate: (iso: string, withTime?: boolean) => string;
  copied: boolean;
  onCopy: (awb: string) => void;
  onReset: () => void;
  detailPath: string | null;
  contactPath: string;
  text: (value: { id: string; en: string }) => string;
}) {
  const { t } = useTranslation();
  const cancelled = order.status === 'cancelled';
  const reached = STEP_OF[order.status];
  // When each step was first reached, from the order's own history.
  const reachedAt = STEPS.map((_, index) =>
    index === 0 ? order.createdAt : order.history.find((h) => h.status !== 'cancelled' && STEP_OF[h.status] >= index)?.at);
  const awb = order.tracking?.trackingNumber;
  const courier = order.tracking?.courier || order.shippingService.courier;
  const eta = order.status === 'delivered' ? null : order.tracking?.map?.etaAt;
  const helpMessage = t('track.helpMessage', { number: order.number });

  return (
    <section className="track-result" aria-labelledby="track-result-title">
      <header className="track-result__head">
        <div>
          <p className="track__label">{t('track.orderLabel', { number: order.number })}</p>
          <h2 id="track-result-title">{t(`track.headline.${order.status}`)}</h2>
          <p>{t(`track.body.${order.status}`)}</p>
        </div>
        <p className="track-result__placed">{t('track.placed', { date: fmtDate(order.createdAt, false) })}</p>
      </header>

      {cancelled ? (
        <p className="track-result__notice" role="status">
          {order.cancelReason === 'payment_expired' ? t('order.cancelReason.payment_expired') : t('order.status.cancelled')}
        </p>
      ) : (
        <ol className="track-steps" aria-label={t('track.progress')}>
          {STEPS.map((step, index) => (
            <li key={step} className={index < reached ? 'is-done' : index === reached ? 'is-current' : ''} aria-current={index === reached ? 'step' : undefined}>
              <span className="track-steps__dot" aria-hidden="true">{index <= reached && <CheckIcon />}</span>
              <strong>{t(`track.steps.${step}`)}</strong>
              <small>{index <= reached && reachedAt[index] ? fmtDate(reachedAt[index]!) : '-'}</small>
            </li>
          ))}
        </ol>
      )}

      <dl className="track-facts">
        <div><dt>{t('track.courier')}</dt><dd>{courier} · {text(order.shippingService.name)}</dd></div>
        <div>
          <dt>{t('track.awb')}</dt>
          <dd>
            {awb ? (
              <>
                <span id="track-awb">{awb}</span>
                <button id="track-copy" type="button" onClick={() => onCopy(awb)}>{t(copied ? 'track.copied' : 'track.copy')}</button>
              </>
            ) : <span className="track-facts__muted">{t('track.awbPending')}</span>}
          </dd>
        </div>
        <div><dt>{t('track.destination')}</dt><dd>{order.destination.city}, {order.destination.country}</dd></div>
        {eta ? (
          <div><dt>{t('track.arrival')}</dt><dd>{t('track.arrivalBy', { date: fmtDate(eta, false) })}</dd></div>
        ) : (
          <div><dt>{t('track.estimate')}</dt><dd>{t('checkout.eta', { days: order.shippingService.etaDays })}</dd></div>
        )}
      </dl>

      {!cancelled && (
        <section className="track-journey" aria-labelledby="track-journey-title">
          <h3 id="track-journey-title" className="track__label">{t('track.journey')}</h3>
          {order.tracking
            ? <ShipmentJourney tracking={order.tracking} fmtDate={fmtDate} />
            : <p className="track-journey__empty">{t('order.trackingEmpty')}</p>}
        </section>
      )}

      <section className="track-items" aria-labelledby="track-items-title">
        <h3 id="track-items-title" className="track__label">{t('track.items')}</h3>
        <ul>
          {order.items.map((item, index) => (
            <li key={index}>
              <div className="track-items__media"><SmartImage src={item.image} alt="" category="ring" /></div>
              <div><strong>{text(item.name)}</strong><span>{text(item.variantLabel)}</span></div>
              <span>×{item.qty}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="track-result__foot">
        {detailPath && <NavLink id="track-detail" className="guide-btn" to={detailPath}>{t('track.viewOrder')}</NavLink>}
        {BRAND_CONTACT.isPlaceholder ? (
          <NavLink id="track-help" className="guide-btn guide-btn--outline" to={contactPath}>{t('track.help')}</NavLink>
        ) : (
          <a id="track-help" className="guide-btn guide-btn--outline" href={buildWhatsAppLink(helpMessage)} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={18} />{t('track.help')}
          </a>
        )}
        <button id="track-another" type="button" className="track-result__reset" onClick={onReset}>{t('track.another')}</button>
      </footer>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}
