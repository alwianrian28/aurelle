import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useAddressStore } from '../../store/addressStore';
import { canPay } from '../../store/orderStore';
import { products } from '../../mocks/catalog';
import { useLocale, useLocalePath, useLocalized } from '../../hooks/useLocale';
import { useMyOrders } from '../../hooks/useMyOrders';
import { formatOrderMoney } from '../../utils/currency';
import type { Order, ReadyStockOrderStatus } from '../../types/domain';
import EmailVerifyNotice from '../../components/EmailVerifyNotice';
import { ArrowLink, CheckIcon, OrderBadge, Thumb, TruckIcon, isOpenOrder, useShortDate } from './parts';

const STEPS = ['paid', 'processing', 'shipped', 'delivered'] as const;
/** The step an order is at; -1 while it still waits for payment. */
const STEP_OF: Record<ReadyStockOrderStatus, number> = {
  awaiting_payment: -1,
  pending_decision: -1,
  cancelled: -1,
  confirmed: 0,
  preparing: 1,
  ready_to_ship: 1,
  shipped: 2,
  delivered: 3,
};

/** My Account overview: the order in progress, past orders, wishlist and default address. */
export default function AccountOverview() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const user = useAuthStore((s) => s.user);
  const wishlistIds = useWishlistStore((s) => s.productIds);
  const addresses = useAddressStore((s) => s.addresses);
  const orders = useMyOrders();

  const wished = wishlistIds.map((id) => products.find((p) => p.id === id)).filter((p): p is (typeof products)[number] => !!p && p.active);
  const current = orders.find(isOpenOrder);
  const others = orders.filter((o) => o !== current).slice(0, 3);
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];

  const wishlistCard = (
    <section className="acct-card" aria-labelledby="overview-wishlist-title">
      <div className="acct-card__head">
        <h2 id="overview-wishlist-title" className="acct-label acct-label--ink">{t('account.wishlist')}</h2>
        {wished.length > 0 && <span>{t('acct.saved', { count: wished.length })}</span>}
      </div>
      {wished.length > 0 ? (
        <>
          <div className="acct-thumbs">{wished.slice(0, 4).map((p) => <Thumb key={p.id} src={p.media[0]?.src} size={72} />)}</div>
          <ArrowLink id="overview-wishlist" to={path('/account/wishlist')}>{t('acct.viewWishlist')}</ArrowLink>
        </>
      ) : (
        <>
          <p className="acct-card__text">{t('acct.wishlistHint')}</p>
          <ArrowLink id="overview-wishlist" to={path('/shop')}>{t('acct.browse')}</ArrowLink>
        </>
      )}
    </section>
  );

  if (orders.length === 0) return <FirstSteps wishlistCard={wishlistCard} addressCount={addresses.length} />;

  return (
    <>
      {user && !user.emailVerified && <EmailVerifyNotice />}
      {current && <CurrentOrder order={current} />}

      {others.length > 0 && (
        <section className="acct-card" aria-labelledby="overview-orders-title">
          <div className="acct-card__head acct-card__head--rule">
            <h2 id="overview-orders-title" className="acct-label acct-label--ink">{t(current && !others.some(isOpenOrder) ? 'acct.pastOrders' : 'acct.recentOrders')}</h2>
            <ArrowLink id="overview-all-orders" to={path('/account/orders')}>{t('acct.allOrders')}</ArrowLink>
          </div>
          <ul className="acct-past">
            {others.map((o) => <PastOrder key={o.id} order={o} />)}
          </ul>
        </section>
      )}

      <div className="acct-pair">
        {wishlistCard}
        <section className="acct-card" aria-labelledby="overview-address-title">
          <div className="acct-card__head">
            <h2 id="overview-address-title" className="acct-label acct-label--ink">{t('acct.defaultAddress')}</h2>
            {addresses.length > 0 && <span>{t('acct.saved', { count: addresses.length })}</span>}
          </div>
          {defaultAddress ? (
            <address className="acct-card__text">
              {defaultAddress.recipient}<br />
              {defaultAddress.line1}<br />
              {defaultAddress.city}, {defaultAddress.postalCode}<br />
              {defaultAddress.phoneCountryCode} {defaultAddress.phone}
            </address>
          ) : <p className="acct-card__text">{t('acct.noAddress')}</p>}
          <ArrowLink id="overview-addresses" to={path('/account/addresses')}>{t(defaultAddress ? 'acct.manageAddresses' : 'acct.addAddress')}</ArrowLink>
        </section>
      </div>
    </>
  );
}

function CurrentOrder({ order }: { order: Order }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const text = useLocalized();
  const date = useShortDate();
  const at = STEP_OF[order.status];
  const reachedAt = [
    order.history.find((h) => h.paymentStatus === 'paid')?.at,
    order.history.find((h) => h.status === 'preparing' || h.status === 'ready_to_ship')?.at,
    order.history.find((h) => h.status === 'shipped')?.at,
    order.history.find((h) => h.status === 'delivered')?.at,
  ];
  const first = order.items[0];
  const extra = order.items.length - 1;
  const awb = order.tracking?.trackingNumber;
  const courier = order.tracking?.courier || order.shippingService.courier;

  return (
    <section className="acct-card acct-current" aria-labelledby="overview-current-title">
      <div className="acct-card__head">
        <p className="acct-label acct-label--ink">{t('acct.currentOrder')}</p>
        <OrderBadge status={order.status} />
      </div>
      <h2 id="overview-current-title">{t(`acct.current.${order.status}`, { number: order.number })}</h2>

      <ol className="acct-steps" aria-label={t('acct.progress')}>
        {STEPS.map((step, index) => (
          <li key={step} className={index < at ? 'is-done' : index === at ? 'is-current' : ''} aria-current={index === at ? 'step' : undefined}>
            <span className="acct-steps__dot" aria-hidden="true">{index < at && <CheckIcon />}</span>
            <strong>{t(`acct.steps.${step}`)}</strong>
            <small>{index <= at && reachedAt[index] ? date(reachedAt[index]!) : '—'}</small>
          </li>
        ))}
      </ol>

      <div className="acct-current__foot">
        <div className="acct-line">
          <Thumb src={first?.image} size={56} />
          <div>
            <strong>{text(first?.name)}{extra > 0 && <span> {t('acct.moreItems', { count: extra })}</span>}</strong>
            <span>{awb ? t('acct.tracking', { courier, number: awb }) : `${courier} · ${text(order.shippingService.name)}`}</span>
          </div>
        </div>
        <div className="acct-actions">
          {canPay(order) ? (
            <NavLink id="overview-pay" className="guide-btn" to={path(`/checkout/payment/${order.id}`)}>{t('order.payNow')}</NavLink>
          ) : (
            <NavLink id="overview-track" className="guide-btn" to={`${path('/track-order')}?order=${encodeURIComponent(order.number)}`}><TruckIcon />{t('acct.trackShipment')}</NavLink>
          )}
          <NavLink id="overview-details" className="guide-btn guide-btn--outline" to={path(`/account/orders/${order.id}`)}>{t('acct.orderDetails')}</NavLink>
        </div>
      </div>
    </section>
  );
}

function PastOrder({ order }: { order: Order }) {
  const path = useLocalePath();
  const locale = useLocale();
  const date = useShortDate();
  return (
    <li>
      <NavLink id={`overview-order-${order.id}`} to={path(`/account/orders/${order.id}`)}>
        <strong>{order.number}</strong>
        <span>{date(order.createdAt, true)}</span>
        <span className="acct-thumbs acct-thumbs--sm">{order.items.slice(0, 3).map((i) => <Thumb key={i.variantId} src={i.image} size={40} />)}</span>
        <span className="acct-past__total">{formatOrderMoney(order.costs.total, order, locale)}</span>
        <OrderBadge status={order.status} />
      </NavLink>
    </li>
  );
}

/** No orders yet: a welcome, what is still needed before the first checkout, and two small cards. */
function FirstSteps({ wishlistCard, addressCount }: { wishlistCard: React.ReactNode; addressCount: number }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const { user, updateProfile, resendVerification } = useAuthStore();
  const [sent, setSent] = useState<{ token?: string } | null>(null);
  if (!user) return null;

  const hasAddress = addressCount > 0;
  const done = 1 + Number(hasAddress) + Number(user.emailVerified);
  const sendLink = async () => {
    const res = await resendVerification();
    setSent({ token: res.devToken });
  };

  return (
    <>
      <section className="acct-welcome" aria-labelledby="overview-welcome-title">
        <div>
          <h2 id="overview-welcome-title">{t('acct.welcomeTitle')}</h2>
          <p>{t('acct.welcomeBody')}</p>
        </div>
        <div className="acct-actions">
          <NavLink id="overview-shop" className="guide-btn acct-welcome__primary" to={path('/shop')}>{t('acct.shopAll')}</NavLink>
          <NavLink id="overview-collections" className="guide-btn acct-welcome__ghost" to={path('/collections')}>{t('acct.collections')}</NavLink>
        </div>
      </section>

      <section className="acct-card" aria-labelledby="overview-ready-title">
        <div className="acct-card__head acct-card__head--rule acct-card__head--stack">
          <h2 id="overview-ready-title" className="acct-label acct-label--ink">{t('acct.readyTitle')}</h2>
          <span>{t('acct.readyCount', { done, total: 3 })}</span>
        </div>
        <ul className="acct-checklist">
          <li className="is-done">
            <span className="acct-checklist__dot" aria-hidden="true"><CheckIcon /></span>
            <div><strong>{t('acct.stepAccount')}</strong><span>{t('acct.stepAccountBody', { name: user.username })}</span></div>
            <em>{t('acct.done')}</em>
          </li>
          <li className={hasAddress ? 'is-done' : ''}>
            <span className="acct-checklist__dot" aria-hidden="true">{hasAddress && <CheckIcon />}</span>
            <div><strong>{t('acct.stepAddress')}</strong><span>{hasAddress ? t('acct.stepAddressDone', { count: addressCount }) : t('acct.stepAddressTodo')}</span></div>
            {hasAddress ? <em>{t('acct.done')}</em> : <NavLink id="overview-add-address" className="acct-chip" to={path('/account/addresses')}>{t('acct.add')}</NavLink>}
          </li>
          <li className={user.emailVerified ? 'is-done' : ''}>
            <span className="acct-checklist__dot" aria-hidden="true">{user.emailVerified && <CheckIcon />}</span>
            <div>
              <strong>{t('acct.stepVerify')}</strong>
              <span role="status">
                {user.emailVerified ? t('acct.stepVerifyDone', { email: user.email }) : sent ? t('acct.linkSent') : t('acct.stepVerifyBody')}
                {/* Outside production the API returns the token, so the flow can be finished without an inbox. */}
                {sent?.token && <> <NavLink id="simulate-verify" to={path(`/auth/verify-email?token=${sent.token}`)}>{t('authFlow.simulateVerifyLink')}</NavLink></>}
              </span>
            </div>
            {user.emailVerified ? <em>{t('acct.done')}</em> : <button id="resend-verification" type="button" className="acct-chip" onClick={() => void sendLink()} disabled={!!sent}>{t('acct.sendLink')}</button>}
          </li>
        </ul>
      </section>

      <div className="acct-pair">
        {wishlistCard}
        <section className="acct-card" aria-labelledby="overview-newsletter-title">
          <div className="acct-card__head">
            <h2 id="overview-newsletter-title" className="acct-label acct-label--ink">{t('acct.newsletter')}</h2>
          </div>
          <label className="acct-check">
            <input id="overview-newsletter" type="checkbox" checked={user.newsletter} onChange={(e) => updateProfile({ newsletter: e.target.checked })} />
            <span>{t('acct.newsletterLabel')}</span>
          </label>
        </section>
      </div>
    </>
  );
}
