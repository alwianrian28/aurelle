import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canPay, useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../store/authStore';
import { useMyOrders } from '../../hooks/useMyOrders';
import { useCountdown, formatDuration } from '../../hooks/useCountdown';
import { useLocale, useLocalePath, useLocalized } from '../../hooks/useLocale';
import { formatOrderMoney } from '../../utils/currency';
import { confirmWithBank, hidePaymentForm, loadPaymentConfig, loadQrisCode, payWithCard, qrPicture, showPaymentForm, syncPayment, type PayProblem, type QrisCode, type SnapOutcome } from '../../lib/payments';
import { BRAND_CONTACT, buildWhatsAppLink } from '../../config/brand';
import SmartImage from '../../components/SmartImage';
import type { Order, PaymentMethod } from '../../types/domain';
import './Checkout.css';

type View = 'form' | 'confirming' | 'paid' | 'failed' | 'review' | 'expired';
const YEAR = new Date().getFullYear();
const FOOT_LINKS = ['shipping', 'payment', 'revision-return', 'privacy', 'terms'] as const;
const EMBED_ID = 'payment-form';
const STEP: Record<Order['status'], number> = { awaiting_payment: 0, pending_decision: 0, cancelled: 0, confirmed: 1, preparing: 2, ready_to_ship: 2, shipped: 3, delivered: 4 };

/**
 * Step 2 of checkout: paying for an order, and what came of it (§5.1).
 * Midtrans' own form (card fields, or the QRIS code) is shown inside this page. The page never
 * marks an order paid itself: it shows what the API reports, and the API hears it from
 * Midtrans (AC-08-05, FR-08-09). Without Midtrans keys (local development) a simulator stands
 * in for the gateway.
 */
export default function Payment() {
  const { orderId } = useParams();
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const text = useLocalized();
  const orders = useMyOrders();
  const user = useAuthStore((s) => s.user);
  const { startPayment, handleGatewayRedirect, expireStale } = useOrderStore();
  const order = orders.find((o) => o.id === orderId);
  const remaining = useCountdown(order?.status === 'awaiting_payment' ? order.reservationExpiresAt : undefined);

  const [gateway, setGateway] = useState<'loading' | 'midtrans' | 'demo'>('loading');
  // Whether cards are paid in the shop's own form (Midtrans Core API) or in Midtrans' form.
  const [ownCardForm, setOwnCardForm] = useState(false);
  const [ownQris, setOwnQris] = useState(false);
  // The method the customer switched to on this page, if any; otherwise the order's own.
  const [chosen, setChosen] = useState<PaymentMethod | null>(null);
  // Set when the form says the customer is done, until the API has told us the outcome.
  const [confirming, setConfirming] = useState(false);
  // "Try again" after a failure: show the form again although the order still says failed.
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<PayProblem | null>(null);

  useEffect(() => {
    let alive = true;
    void loadPaymentConfig().then((c) => { if (alive) { setGateway(c.midtransClientKey ? 'midtrans' : 'demo'); setOwnCardForm(c.cardForm === 'own'); setOwnQris(c.qrisForm === 'own'); } });
    return () => { alive = false; };
  }, []);

  // Kedaluwarsakan reservasi saat waktu habis (AC-08-04).
  useEffect(() => {
    if (order?.status === 'awaiting_payment' && order.paymentStatus !== 'pending' && remaining === 0) expireStale();
  }, [remaining, order?.status, order?.paymentStatus, expireStale]);

  const id = order?.id;
  const waiting = order?.status === 'awaiting_payment';
  // While the order waits for payment, keep asking the API: this is how a scanned QRIS code
  // or a finished card payment shows up here without a reload. Paused while the tab is hidden.
  useEffect(() => {
    if (!id || !waiting || gateway !== 'midtrans') return;
    void syncPayment(id);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void syncPayment(id); }, 5000);
    return () => window.clearInterval(timer);
  }, [id, waiting, gateway]);

  if (!order) {
    return (
      <Chrome title={t('order.notFound')} t={t} path={path}>
        <section className="pay-panel">
          <h1>{t('order.notFound')}</h1>
          <div className="pay-actions"><NavLink id="payment-orders" to={path('/account/orders')} className="guide-btn guide-btn--outline">{t('order.backToOrders')}</NavLink></div>
        </section>
      </Chrome>
    );
  }

  const money = (idr: number) => formatOrderMoney(idr, order, locale);
  const method = chosen ?? order.paymentMethod;
  // "Pending" is still open: the QRIS code is on screen, or the bank is asking for an OTP.
  const payable = order.status === 'awaiting_payment' && (order.paymentStatus === 'pending' || canPay(order));
  const settled = order.paymentStatus === 'paid' || order.paymentStatus === 'failed' || order.status !== 'awaiting_payment';
  const view: View =
    order.status === 'pending_decision' || order.paymentStatus === 'review_finance' ? 'review'
      : order.paymentStatus === 'paid' ? 'paid'
        : order.status === 'cancelled' || !payable ? 'expired'
          : confirming && !settled ? 'confirming'
            : order.paymentStatus === 'failed' && !retrying ? 'failed'
              : 'form';

  /** The form is done with the customer: ask the API what happened, and show that. */
  const onOutcome = (outcome: SnapOutcome) => {
    if (outcome === 'closed') return;
    setRetrying(false);
    setConfirming(true);
    void syncPayment(order.id).then((fresh) => {
      // A QRIS code that is not paid yet goes back on screen; a card stays "confirming" until Midtrans decides.
      if (!fresh || (fresh.paymentMethod === 'qris' && fresh.paymentStatus !== 'paid' && fresh.paymentStatus !== 'failed')) setConfirming(false);
    });
  };
  const showForm = (next: PaymentMethod) => { setChosen(next); setRetrying(true); setConfirming(false); setProblem(null); setAttempt((n) => n + 1); };
  const simulate = (outcome: 'success' | 'failed') => { setRetrying(false); startPayment(order.id, method); handleGatewayRedirect(order.id, outcome); };

  const other: PaymentMethod = method === 'card' ? 'qris' : 'card';
  // FR-03-07: QRIS is offered for IDR only.
  const canSwitch = other === 'card' || order.currency === 'IDR';
  const held = <p className="pay-hold" role="timer"><ClockIcon /><span>{t('payment.held')} <strong>{t('payment.minutes', { time: formatDuration(remaining) })}</strong>.</span></p>;
  const firstName = (user?.username ?? '').trim().split(/\s+/)[0];
  const paidAt = order.history.find((h) => h.paymentStatus === 'paid')?.at;
  const step = STEP[order.status];
  const when = (iso: string) => new Date(iso).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const timeline: [string, string][] = [
    [t('payment.next.paid'), paidAt ? when(paidAt) : ''],
    [t('payment.next.prepare'), t('payment.next.prepareHint')],
    [t('payment.next.ship', { courier: order.shippingService.courier }), order.tracking?.trackingNumber ? t('payment.next.tracking', { number: order.tracking.trackingNumber }) : t('payment.next.shipHint')],
    [t('payment.next.delivered'), t('payment.next.deliveredHint', { days: order.shippingService.etaDays })],
  ];
  const help = !BRAND_CONTACT.isPlaceholder && (
    <p className="pay-help">
      <ChatIcon />
      <span>{t('payment.trouble')} <a id="payment-help" href={buildWhatsAppLink(t('track.helpMessage', { number: order.number }))} target="_blank" rel="noopener noreferrer">{t('payment.chat')}</a> {t('payment.mention', { number: order.number })}</span>
    </p>
  );

  return (
    <Chrome title={t(`payment.title.${view === 'form' ? 'awaiting' : view === 'confirming' ? 'pending' : view}`)} t={t} path={path} back={view === 'form' || view === 'failed' ? path(`/account/orders/${order.id}`) : undefined}>
      <div className="co__inner co__layout pay-layout">
        <section className={`pay-panel pay-panel--${view}`} aria-live="polite">
          {view === 'form' && (
            <>
              <p className="pay-eyebrow">{t('payment.step')}</p>
              <h1 id="payment-title">{t(method === 'qris' ? 'payment.qrisTitle' : 'payment.cardTitle')}</h1>
              {held}
              {gateway === 'midtrans' && method === 'card' && ownCardForm && (
                <CardForm key={attempt} orderId={order.id} total={money(order.costs.total)} onOutcome={onOutcome} />
              )}
              {gateway === 'midtrans' && method === 'qris' && ownQris && (
                <QrisPanel key={attempt} orderId={order.id} number={order.number} total={money(order.costs.total)} />
              )}
              {gateway === 'midtrans' && !(method === 'card' && ownCardForm) && !(method === 'qris' && ownQris) && (
                <>
                  <PaymentForm key={`${method}-${attempt}`} orderId={order.id} method={method} onOutcome={onOutcome} onProblem={setProblem} loading={t('payment.loadingForm')} />
                  {problem && (
                    <div className="pay-alert" role="alert">
                      <p>{problem === 'network' ? t('authPage.networkError') : t('payment.unavailable')}</p>
                      <button id="payment-reload" type="button" className="pay-link" onClick={() => showForm(method)}>{t('payment.tryAgain')}</button>
                    </div>
                  )}
                  <p className="pay-note"><LockIcon />{t(method === 'qris' ? 'payment.qrisNote' : 'payment.cardNote')}</p>
                </>
              )}
              {gateway === 'demo' && (
                <div className="pay-demo">
                  <p>{t('payment.gatewayBody')}</p>
                  <div className="pay-actions">
                    <button className="guide-btn" onClick={() => simulate('success')} id="pay-simulate-success">{t('payment.simulateSuccess')}</button>
                    <button className="guide-btn guide-btn--outline" onClick={() => simulate('failed')} id="pay-simulate-fail">{t('payment.simulateFail')}</button>
                  </div>
                </div>
              )}
              <div className="pay-foot">
                {method === 'qris' && gateway === 'midtrans' ? <p className="pay-waiting"><i aria-hidden="true" />{t('payment.waiting')}</p> : <span />}
                {canSwitch && <button id="payment-switch" type="button" className="pay-link" onClick={() => showForm(other)}>{t(other === 'qris' ? 'payment.switchQris' : 'payment.switchCard')}</button>}
              </div>
            </>
          )}

          {view === 'confirming' && (
            <div className="pay-confirming">
              <span className="pay-spinner" aria-hidden="true" />
              <h1 id="payment-title">{t('payment.confirmingTitle')}</h1>
              <p className="pay-body">{t('payment.confirmingBody')}</p>
              <button id="payment-back" type="button" className="pay-link" onClick={() => showForm(method)}>{t('payment.backToForm')}</button>
            </div>
          )}

          {view === 'failed' && (
            <>
              <span className="pay-icon pay-icon--bad" aria-hidden="true"><CrossIcon /></span>
              <p className="pay-eyebrow">{t('payment.orderTag', { number: order.number })} · {t('payment.notPaid')}</p>
              <h1 id="payment-title">{t('payment.failedHeading')}</h1>
              <p className="pay-body">{t('payment.failedReason')}</p>
              {held}
              <div className="pay-actions">
                <button id="payment-retry" type="button" className="guide-btn" onClick={() => showForm(method)}>{t('payment.tryAgain')}</button>
                {canSwitch && <button id="payment-other" type="button" className="guide-btn guide-btn--outline" onClick={() => showForm(other)}>{t(other === 'qris' ? 'payment.payWithQris' : 'payment.payByCard')}</button>}
              </div>
              {help}
            </>
          )}

          {view === 'paid' && (
            <>
              <span className="pay-icon pay-icon--good" aria-hidden="true"><CheckIcon /></span>
              <p className="pay-eyebrow">{t('payment.orderTag', { number: order.number })} · {t('payment.paidTag')}</p>
              <h1 id="payment-title">{firstName ? t('payment.thanksName', { name: firstName }) : t('payment.thanks')}</h1>
              <p className="pay-body">{t('payment.paidBody', { total: money(order.costs.total) })}</p>
              <div className="pay-next">
                <h2>{t('payment.next.title')}</h2>
                <ol>
                  {timeline.map(([label, hint], i) => (
                    <li key={label} className={i < step ? 'is-done' : ''}>
                      <span className="pay-next__dot" aria-hidden="true">{i < step && <CheckIcon small />}</span>
                      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="pay-actions">
                <NavLink id="payment-order" to={path(`/account/orders/${order.id}`)} className="guide-btn">{t('payment.viewMyOrder')}</NavLink>
                <NavLink id="payment-shop" to={path('/shop')} className="guide-btn guide-btn--outline">{t('payment.continueShopping')}</NavLink>
              </div>
            </>
          )}

          {(view === 'review' || view === 'expired') && (
            <>
              <span className={`pay-icon${view === 'expired' ? ' pay-icon--bad' : ''}`} aria-hidden="true">{view === 'expired' ? <CrossIcon /> : <ClockIcon large />}</span>
              <p className="pay-eyebrow">{t('payment.orderTag', { number: order.number })}</p>
              <h1 id="payment-title">{t(`payment.title.${view}`)}</h1>
              <p className="pay-body">{t(`payment.body.${view}`, { number: order.number })}</p>
              <div className="pay-actions">
                <NavLink id="payment-order" to={path(`/account/orders/${order.id}`)} className="guide-btn">{t('payment.viewMyOrder')}</NavLink>
                <NavLink id="payment-shop" to={path('/shop')} className="guide-btn guide-btn--outline">{t('payment.continueShopping')}</NavLink>
              </div>
              {help}
            </>
          )}
        </section>

        <aside className="co-summary pay-summary" aria-labelledby="pay-summary-title">
          <div className="pay-summary__head">
            <h2 id="pay-summary-title">{t('payment.orderTag', { number: order.number })}</h2>
            <span>{t('payment.items', { count: order.items.reduce((n, i) => n + i.qty, 0) })}</span>
          </div>
          <ul className="co-items">
            {order.items.map((item) => (
              <li key={item.variantId}>
                <div className="co-items__media">
                  <SmartImage src={item.image} alt="" category="ring" />
                  {item.qty > 1 && <span>{item.qty}</span>}
                </div>
                <div><strong>{text(item.name)}</strong><span>{text(item.variantLabel)}</span></div>
                <span>{money(item.unitPriceIdr * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="co-costs">
            <div><dt>{t('common.subtotal')}</dt><dd>{money(order.costs.subtotal)}</dd></div>
            <div><dt>{t('checkout.shippingRow', { courier: order.shippingService.courier })}</dt><dd>{money(order.costs.shipping)}</dd></div>
            {order.costs.tax > 0 && <div><dt>{t('common.tax')}</dt><dd>{money(order.costs.tax)}</dd></div>}
            {order.costs.duty > 0 && <div><dt>{t('common.duty')} <small>{t('checkout.estimate')}</small></dt><dd>{money(order.costs.duty)}</dd></div>}
            {order.costs.other > 0 && <div><dt>{t('common.other')}</dt><dd>{money(order.costs.other)}</dd></div>}
          </dl>
          <p className="co-total"><span>{t('common.total')}</span><strong id="payment-amount">{money(order.costs.total)}</strong></p>
          <p className="co-summary__note">{t('payment.shippingTo', { name: order.addressSnapshot.recipient, city: order.addressSnapshot.city, country: order.addressSnapshot.country })}</p>
        </aside>
      </div>
    </Chrome>
  );
}

const onlyDigits = (text: string) => text.replace(/\D/g, '');
/** Luhn check: catches a mistyped card number before it is sent anywhere. */
function luhn(number: string): boolean {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let d = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return number.length >= 13 && number.length <= 19 && sum % 10 === 0;
}
/** A card is good through the last day of its expiry month. */
function stillValid(month: string, year: string): boolean {
  if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^\d{2}$/.test(year)) return false;
  const now = new Date();
  return 2000 + Number(year) > now.getFullYear() || (2000 + Number(year) === now.getFullYear() && Number(month) >= now.getMonth() + 1);
}
const brandOf = (number: string) => (/^4/.test(number) ? 'visa' : /^(5[1-5]|2[2-7])/.test(number) ? 'mc' : '');

/**
 * The shop's own card form: only what Midtrans needs to charge a card (it does not ask for the
 * name on it). What is typed here goes to Midtrans from this browser and comes
 * back as a one-time token; Aurelle's server only ever sees that token. When the bank wants
 * an OTP, its page opens in a dialog over the form.
 */
function CardForm({ orderId, total, onOutcome }: { orderId: string; total: string; onOutcome: (outcome: SnapOutcome) => void }) {
  const { t } = useTranslation();
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bankUrl, setBankUrl] = useState('');

  const digits = onlyDigits(number);
  const [month = '', year = ''] = expiry.split('/').map((part) => part.trim());
  const bad = {
    number: !luhn(digits),
    expiry: !stillValid(month, year),
    cvv: !/^\d{3,4}$/.test(cvv),
  };
  const valid = !Object.values(bad).some(Boolean);
  const brand = brandOf(digits);

  const pay = async () => {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    const result = await payWithCard(orderId, { number: digits, month, year: `20${year}`, cvv });
    if (!result.ok) {
      setBusy(false);
      // "not_allowed": the order was paid or closed meanwhile; the page already shows that.
      if (result.reason !== 'not_allowed') setError(t(result.reason === 'card' ? 'payment.card.rejected' : result.reason === 'network' ? 'authPage.networkError' : 'payment.unavailable'));
      return;
    }
    if (result.redirectUrl) await confirmWithBank(result.redirectUrl, setBankUrl);
    setBankUrl('');
    onOutcome('success'); // "the customer is done": the page now asks the API what happened
  };

  return (
    <form className="card-form" onSubmit={(e) => { e.preventDefault(); void pay(); }} noValidate>
      <label className="card-field">
        <span>{t('payment.card.number')}</span>
        <span className={`card-input${tried && bad.number ? ' is-invalid' : ''}`}>
          <input id="card-number" inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" maxLength={23} value={number}
            onChange={(e) => setNumber(onlyDigits(e.target.value).slice(0, 19).replace(/(.{4})(?=.)/g, '$1 '))} aria-invalid={tried && bad.number} disabled={busy} />
          {/* Both logos until the number says which card it is; then the other one fades. */}
          <span className={`card-brands${brand ? ' has-brand' : ''}`} aria-hidden="true">
            <img className={brand === 'visa' ? 'is-on' : ''} src="/media/icons/visa.png" alt="" width={40} height={26} />
            <img className={brand === 'mc' ? 'is-on' : ''} src="/media/icons/mastercard.png" alt="" width={40} height={26} />
          </span>
        </span>
        {tried && bad.number && <small role="alert">{t('payment.card.numberError')}</small>}
      </label>
      <div className="card-row">
        <label className="card-field">
          <span>{t('payment.card.expiry')}</span>
          <input id="card-expiry" className={`card-input${tried && bad.expiry ? ' is-invalid' : ''}`} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" maxLength={7} value={expiry}
            onChange={(e) => { const d = onlyDigits(e.target.value).slice(0, 4); setExpiry(d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d); }} aria-invalid={tried && bad.expiry} disabled={busy} />
          {tried && bad.expiry && <small role="alert">{t('payment.card.expiryError')}</small>}
        </label>
        <label className="card-field">
          <span>{t('payment.card.cvv')}</span>
          <input id="card-cvv" className={`card-input${tried && bad.cvv ? ' is-invalid' : ''}`} type="password" inputMode="numeric" autoComplete="cc-csc" placeholder={t('payment.card.cvvHint')} maxLength={4} value={cvv}
            onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))} aria-invalid={tried && bad.cvv} disabled={busy} />
          {tried && bad.cvv && <small role="alert">{t('payment.card.cvvError')}</small>}
        </label>
      </div>
      {error && <p className="pay-alert" role="alert">{error}</p>}
      <button id="card-pay" type="submit" className="guide-btn card-form__pay" disabled={busy}><LockIcon />{busy ? t('payment.card.processing') : t('payment.payNow', { total })}</button>
      <p className="pay-note pay-note--plain">{t('payment.card.note')}</p>

      {bankUrl && (
        <div className="bank-dialog" role="dialog" aria-modal="true" aria-label={t('payment.card.bankTitle')}>
          <div className="bank-dialog__box">
            <p className="bank-dialog__title"><LockIcon />{t('payment.card.bankTitle')}</p>
            <iframe id="card-bank-frame" title={t('payment.card.bankTitle')} src={bankUrl} />
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * The shop's own QRIS display: the code for this attempt, the amount, and how to pay it. The
 * page around it keeps asking the API whether the payment arrived, so nothing here needs
 * pressing after the scan.
 */
function QrisPanel({ orderId, number, total }: { orderId: string; number: string; total: string }) {
  const { t } = useTranslation();
  const [code, setCode] = useState<QrisCode | null>(null);
  const [picture, setPicture] = useState('');
  const [problem, setProblem] = useState<PayProblem | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    void loadQrisCode(orderId).then(async (result) => {
      if (!alive) return;
      if (!result.ok) { setProblem(result.reason); return; }
      const image = await qrPicture(result.code.qrString, 440).catch(() => '');
      if (!alive) return;
      setProblem(image ? null : 'unavailable');
      setCode(result.code);
      setPicture(image);
    });
    return () => { alive = false; };
  }, [orderId, round]);

  const download = async () => {
    if (!code) return;
    // Larger, and with the white border scanners need around a code that is shown on its own.
    const link = document.createElement('a');
    link.href = await qrPicture(code.qrString, 900, 3);
    link.download = `aurelle-qris-${number}.png`;
    link.click();
  };

  const steps: [React.ReactNode, string][] = [
    [<PhoneIcon key="a" />, t('payment.qris.open')],
    [<ScanIcon key="b" />, t('payment.qris.scan')],
    [<CheckIcon key="c" small />, t('payment.qris.check', { total })],
  ];

  if (problem && problem !== 'not_allowed') {
    return (
      <div className="pay-alert" role="alert">
        <p>{problem === 'network' ? t('authPage.networkError') : t('payment.unavailable')}</p>
        <button id="qris-reload" type="button" className="pay-link" onClick={() => { setProblem(null); setRound((n) => n + 1); }}>{t('payment.tryAgain')}</button>
      </div>
    );
  }

  return (
    <div className="qris">
      <div className="qris__code">
        <p className="qris__brand">QRIS</p>
        {picture
          ? <img id="qris-image" src={picture} width={220} height={220} alt={t('payment.qris.alt', { total })} />
          : <span className="qris__loading"><span className="pay-spinner pay-spinner--small" aria-hidden="true" />{t('payment.qris.loading')}</span>}
        {code && (code.merchant || code.nmid) && <p className="qris__merchant">{[code.merchant, code.nmid].filter(Boolean).join(' · ')}</p>}
      </div>
      <div className="qris__how">
        <p className="qris__label">{t('payment.amount')}</p>
        <p className="qris__amount" id="qris-amount">{total}</p>
        <ol>
          {steps.map(([icon, text]) => <li key={text}><span aria-hidden="true">{icon}</span>{text}</li>)}
        </ol>
        <button id="qris-download" type="button" className="guide-btn guide-btn--outline qris__download" disabled={!picture} onClick={() => void download()}><DownloadIcon />{t('payment.qris.download')}</button>
      </div>
    </div>
  );
}

/** Midtrans' form for one attempt. A new method or a retry mounts a new one (see `key`). */
function PaymentForm({ orderId, method, onOutcome, onProblem, loading }: {
  orderId: string; method: PaymentMethod; onOutcome: (outcome: SnapOutcome) => void; onProblem: (problem: PayProblem | null) => void; loading: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void showPaymentForm(orderId, method, EMBED_ID, (outcome) => { if (alive) onOutcome(outcome); }).then((problem) => {
      if (!alive) return;
      onProblem(problem);
      setReady(!problem);
    });
    return () => { alive = false; hidePaymentForm(); };
    // The callbacks read the page's latest state themselves; this runs once per attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, method]);
  return (
    <div className={`pay-form pay-form--${method}${ready ? ' is-ready' : ''}`}>
      {!ready && <p className="pay-form__loading"><span className="pay-spinner pay-spinner--small" aria-hidden="true" />{loading}</p>}
      <div id={EMBED_ID} />
    </div>
  );
}

/** The checkout's own page chrome: slim bar, slim footer, nothing to wander off to. */
function Chrome({ title, back, t, path, children }: { title: string; back?: string; t: (key: string) => string; path: (to: string) => string; children: React.ReactNode }) {
  return (
    <div className="co co--pay">
      <title>{`${title} | Aurelle`}</title>
      <header className="co-bar">
        <div className="co__inner">
          {back ? <NavLink id="payment-back-link" to={back} className="co-bar__back"><ArrowLeftIcon />{t('payment.orderDetails')}</NavLink> : <span />}
          <NavLink to={path('/store')} className="co-bar__logo" aria-label="Aurelle">AURELLE</NavLink>
          <span className="co-bar__secure"><LockIcon />{t('checkout.secure')}</span>
        </div>
      </header>
      {children}
      <footer className="co-foot">
        <div className="co__inner">
          <span>&copy; {YEAR} Aurelle</span>
          <nav aria-label={t('help.center')}>
            {FOOT_LINKS.map((key) => <NavLink key={key} to={path(`/policies/${key}`)} target="_blank">{t(`checkout.foot.${key}`)}</NavLink>)}
          </nav>
        </div>
      </footer>
    </div>
  );
}

const SVG = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
function ArrowLeftIcon() { return <svg {...SVG}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>; }
function LockIcon() { return <svg {...SVG}><rect x="5" y="10.5" width="14" height="9.5" rx="1.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>; }
function ClockIcon({ large }: { large?: boolean }) { return <svg {...SVG} width={large ? 24 : 18} height={large ? 24 : 18}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>; }
function CheckIcon({ small }: { small?: boolean }) { return <svg {...SVG} width={small ? 12 : 22} height={small ? 12 : 22} strokeWidth={small ? 2.4 : 1.8}><path d="M4.5 12.5l5 5 10-11" /></svg>; }
function CrossIcon() { return <svg {...SVG} width={22} height={22} strokeWidth={1.8}><path d="M6 6l12 12M18 6L6 18" /></svg>; }
function PhoneIcon() { return <svg {...SVG} width={18} height={18}><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" /></svg>; }
function ScanIcon() { return <svg {...SVG} width={18} height={18}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" /></svg>; }
function DownloadIcon() { return <svg {...SVG}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>; }
function ChatIcon() { return <svg {...SVG} width={18} height={18}><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 19z" /><path d="M9.5 9.2c0 3 2.3 5.300 5.300 5.300l.7-1.500-1.800-.9-.7.8c-1-.4-1.800-1.200-2.200-2.200l.8-.7-.9-1.800z" /></svg>; }
