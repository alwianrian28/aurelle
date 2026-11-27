import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIntlLocale, useLocalePath, useLocalized } from '../hooks/useLocale';
import { useMyOrders } from '../hooks/useMyOrders';
import { useCourierTracking } from '../hooks/useCourierTracking';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { BRAND_CONTACT, buildWhatsAppLink } from '../config/brand';
import type { Order, OrderTracking, ShipmentTone, TrackedOrder } from '../types/domain';
import Icon from '../components/ServiceIcons';
import SmartImage from '../components/SmartImage';
import ShipmentMap from '../components/ShipmentMap';
import { TONE_COLOR } from '../components/shipmentTones';
import './TrackOrder.css';

/** The shop keeps Jakarta time: every time on this page is shown in it, marked WIB. */
const ZONE = 'Asia/Jakarta';
/** Courier statuses in which the parcel is on the move. */
const MOVING = new Set(['allocated', 'picking_up', 'picked', 'in_transit', 'dropping_off', 'return_in_transit']);
const COLLECTED = ['picked', 'in_transit', 'dropping_off', 'delivered'];
/** How many updates a phone shows before "Show all". */
const FEW = 3;

/** What the page shows about the buyer: the signed-in owner sees the address, a lookup sees the area. */
export type Shown = TrackedOrder & { recipient?: { name: string; phone: string; lines: string[] }; paymentMethod?: string };

/** A signed-in customer's own order, with the courier's scans and map once they are read. */
function fromOwnOrder(order: Order, live: OrderTracking | null): Shown {
  const a = order.addressSnapshot;
  // The middle of the phone number is hidden: enough to recognise, not enough to copy from a screen.
  const digits = a.phone.replace(/\D/g, '');
  const phone = `${a.phoneCountryCode} ${digits.slice(0, 3)}-••••-${digits.slice(-4)}`;
  return {
    id: order.id, number: order.number, status: order.status, paymentStatus: order.paymentStatus, createdAt: order.createdAt, updatedAt: order.updatedAt,
    cancelReason: order.cancelReason, history: order.history, tracking: live ?? order.tracking, items: order.items, shippingService: order.shippingService,
    destination: { city: a.city, country: a.country }, paymentMethod: order.paymentMethod,
    recipient: { name: a.recipient, phone, lines: [[a.line1, a.line2].filter(Boolean).join(', '), `${a.city}, ${a.state} ${a.postalCode ?? ''}`.trim()] },
  };
}

type Row = { key: string; at: string; tone: 'grey' | 'sand' | 'blue' | 'green' | 'orange' | 'red' | 'purple'; label: string; text: string; note: string };
const SCAN_TONE: Record<string, Row['tone']> = { delivered: 'green', in_transit: 'blue', dropping_off: 'blue', on_hold: 'orange', rejected: 'red', disposed: 'red', cancelled: 'red', courier_not_found: 'red', return_in_transit: 'purple', returned: 'purple' };

/**
 * Track order: one page for where a parcel is.
 * - Signed in: any of your own orders, by its number or from the list.
 * - Anyone: the order number (or the courier's tracking number) together with the email the
 *   order was placed with (POST /orders/track). That answer never carries the street address
 *   or a phone number: the map and "Ship to" show the destination area only.
 * The position on the map is an estimate from the courier's status, and says so.
 */
export default function TrackOrder() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const myOrders = useMyOrders();

  const [number, setNumber] = useState(params.get('order') ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [looked, setLooked] = useState<{ order: TrackedOrder; email: string } | null>(null);
  const [asked, setAsked] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  // An own order is read from the synced store, so it stays current; a looked-up one is a snapshot.
  const picked = params.get('order');
  const own = picked ? myOrders.find((o) => o.number === picked) : undefined;
  // Once a courier is booked, its scans and the map are read for the picked order.
  const live = useCourierTracking(own?.tracking?.status ? own.id : undefined, `${own?.tracking?.updatedAt ?? ''}#${asked}`);
  const order: Shown | null = own ? fromOwnOrder(own, live) : looked && (!picked || looked.order.number === picked) ? looked.order : null;

  const show = (orderNumber: string | null) => setParams(orderNumber ? { order: orderNumber } : {}, { replace: true, preventScrollReset: true });

  const lookUp = async (wanted: string, withEmail: string) => {
    setBusy(true);
    setError('');
    const res = await api<{ order: TrackedOrder }>('/orders/track', { body: { number: wanted, email: withEmail } });
    setBusy(false);
    if (res.ok) {
      setLooked({ order: res.data.order, email: withEmail });
      setNumber(res.data.order.number);
      show(res.data.order.number);
      return;
    }
    setLooked(null);
    setError(t(res.status === 429 ? 'track.tooMany' : res.status === 0 ? 'authPage.networkError' : 'track.notFound'));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const wanted = number.trim();
    if (!wanted || busy) return;
    const mine = myOrders.find((o) => o.number === wanted.toUpperCase());
    if (mine) { setError(''); setLooked(null); show(mine.number); return; }
    const withEmail = (email.trim() || user?.email || '').trim();
    if (!withEmail) { setError(t('track.emailNeeded')); return; }
    void lookUp(wanted, withEmail);
  };

  const refresh = () => {
    if (own) setAsked((n) => n + 1);
    else if (looked && !busy) void lookUp(looked.order.number, looked.email);
  };

  const copyLink = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path('/track-order')}?order=${encodeURIComponent(order.number)}`);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* clipboard blocked: the address bar holds the same link */ }
  };

  return (
    <article className="trk">
      <title>{`${t('track.title')} | Aurelle`}</title>
      <meta name="description" content={t('track.intro')} />

      <div className="container trk__inner">
        <header className="trk__head">
          <div>
            <p className="trk__crumb"><NavLink to={path('/faq')}>{t('track.crumbHelp')}</NavLink> / <span>{t('track.crumb')}</span></p>
            <h1>{t('track.title')}</h1>
          </div>
          {order && <LastUpdate order={order} onRefresh={refresh} busy={busy} />}
        </header>

        <form className="trk-search" onSubmit={submit} noValidate aria-label={t('track.formTitle')}>
          <label className="trk-search__field">
            <span>{t('track.orderNo')}</span>
            <input id="track-number" type="text" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t('track.numberPlaceholder')} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={30} required aria-describedby={error ? 'track-error' : undefined} />
          </label>
          {/* Without a login, the email the order was placed with is what proves the order is yours. */}
          {!user && (
            <label className="trk-search__field trk-search__field--email">
              <span>{t('track.emailShort')}</span>
              <input id="track-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('track.email')} autoComplete="email" maxLength={254} required />
            </label>
          )}
          <button id="track-submit" type="submit" className="trk-btn trk-btn--dark" disabled={busy || !number.trim()} aria-label={t('track.submit')}>
            <SearchGlyph /><span>{busy ? t('track.searching') : t('track.submitShort')}</span>
          </button>
          <button id="track-copy-link" type="button" className="trk-btn" disabled={!order} onClick={() => void copyLink()} aria-label={t('track.copyLink')}>
            <LinkGlyph /><span>{t(linkCopied ? 'track.linkCopied' : 'track.copyLink')}</span>
          </button>
          {error && <p id="track-error" className="trk-search__error" role="alert">{error}</p>}
        </form>

        {user ? myOrders.length > 0 && (
          <nav className="trk-mine" aria-label={t('track.yourOrders')}>
            <span id="track-mine-title">{t('track.yourOrders')}</span>
            <ul>
              {myOrders.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <button id={`track-pick-${o.id}`} type="button" aria-pressed={order?.number === o.number} onClick={() => { setError(''); setLooked(null); setNumber(o.number); show(o.number); }}>
                    {o.number}<small>{t(`order.status.${o.status}`)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : !order && (
          <p className="trk__hint">
            {t('track.loginHint')}{' '}
            <NavLink id="track-login" to={path('/auth/login')} state={{ from: path('/track-order') }}>{t('common.login')}</NavLink>
          </p>
        )}

        <div id="track-main" aria-live="polite">
          {order ? <Result order={order} detailPath={order.id ? path(`/account/orders/${order.id}`) : null} contactPath={path('/contact')} /> : (
            <section className="trk-empty">
              <h2>{t('track.emptyTitle')}</h2>
              <p>{t('track.emptyBody')}</p>
              <ol>
                {(['placed', 'paid', 'preparing', 'shipped', 'delivered'] as const).map((step, index) => <li key={step}><span>{index + 1}</span>{t(`track.steps.${step}`)}</li>)}
              </ol>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

/** Dates and times in the shop's time zone, in the page's language. */
function useWhen() {
  const intl = useIntlLocale();
  const { t } = useTranslation();
  const clock = (iso: string) => `${new Date(iso).toLocaleTimeString(intl, { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false })} ${t('track.wib')}`;
  return {
    valid: (iso: string | null | undefined): iso is string => !!iso && !Number.isNaN(Date.parse(iso)),
    day: (iso: string) => new Date(iso).toLocaleDateString(intl, { timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'short' }),
    longDay: (iso: string) => new Date(iso).toLocaleDateString(intl, { timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'long' }),
    time: clock,
    full: (iso: string) => `${new Date(iso).toLocaleDateString(intl, { timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, ${clock(iso)}`,
  };
}

/** The courier's status in the page's language; one we have no words for is shown as it came. */
function useStatusLabel() {
  const { t, i18n } = useTranslation();
  return (code: string) => (i18n.exists(`shipment.status.${code}`) ? t(`shipment.status.${code}`) : code.replace(/_/g, ' '));
}

/** Everything the page works out from an order: times, distance, and the rows of its history. */
function useFacts(order: Shown) {
  const { t, i18n } = useTranslation();
  const statusLabel = useStatusLabel();
  const tracking = order.tracking;
  const map = tracking?.map ?? null;
  const scans = (tracking?.history ?? []).filter((scan) => scan.status);
  const courierStatus = map?.status ?? tracking?.status ?? null;
  const tone: ShipmentTone = map?.tone ?? (order.status === 'delivered' ? 'green' : order.status === 'cancelled' ? 'gray' : 'normal');
  const delivered = courierStatus === 'delivered' || order.status === 'delivered';

  const firstAt = (codes: string[]) => scans.filter((scan) => codes.includes(scan.status) && Date.parse(scan.at)).map((scan) => scan.at).sort()[0];
  const pickedAt = firstAt(COLLECTED) ?? order.history.find((h) => h.status === 'shipped')?.at;
  const deliveredAt = firstAt(['delivered']) ?? order.history.find((h) => h.status === 'delivered')?.at;
  const lastAt = scans.map((scan) => scan.at).filter((at) => Date.parse(at)).sort().pop() ?? tracking?.updatedAt ?? order.updatedAt ?? order.createdAt;

  const totalKm = map?.route ? Math.round(map.route.distanceKm) : null;
  const leftKm = totalKm !== null && map && !delivered && !map.returning ? Math.max(0, Math.round(totalKm * (1 - map.progress))) : null;

  // One list of everything that happened: the order's own steps, the courier's scans, and the
  // checkpoints staff recorded by hand. Newest first.
  const rows: Row[] = [];
  const seen = new Set<string>();
  const step = (key: string, at: string, rowTone: Row['tone'], extra = '') => {
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ key: `step-${key}`, at, tone: rowTone, label: t(`track.event.${key}.label`), text: t(`track.event.${key}.text`) + extra, note: '' });
  };
  order.history.forEach((event, index) => {
    if (index === 0) step('placed', order.createdAt, 'grey');
    if (event.paymentStatus === 'paid') step('paid', event.at, 'grey', order.paymentMethod ? ` · ${t(order.paymentMethod === 'qris' ? 'checkout.qris' : 'checkout.card')}` : '');
    if (event.status === 'preparing') step('preparing', event.at, 'sand');
    if (event.status === 'ready_to_ship') step('packed', event.at, 'sand');
    if (event.status === 'cancelled') step('cancelled', event.at, 'red');
    // The courier's scans say these two better; they stand in only when there are none.
    if (scans.length === 0 && event.status === 'shipped') step('shipped', event.at, 'blue');
    if (scans.length === 0 && event.status === 'delivered') step('delivered', event.at, 'green');
  });
  scans.forEach((scan, index) => rows.push({
    key: `scan-${index}`, at: scan.at, tone: SCAN_TONE[scan.status] ?? 'grey', label: statusLabel(scan.status),
    text: i18n.exists(`shipment.about.${scan.status}`) ? t(`shipment.about.${scan.status}`) : '', note: scan.note,
  }));
  (tracking?.points ?? []).forEach((point) => rows.push({ key: `point-${point.id}`, at: point.at, tone: 'grey', label: t('track.checkpoint'), text: point.label, note: point.note }));
  rows.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));

  return { tracking, map, courierStatus, tone, delivered, pickedAt, deliveredAt, lastAt, totalKm, leftKm, rows, live: !!courierStatus && MOVING.has(courierStatus), statusLabel };
}

function LastUpdate({ order, onRefresh, busy }: { order: Shown; onRefresh: () => void; busy: boolean }) {
  const { t } = useTranslation();
  const when = useWhen();
  const facts = useFacts(order);
  return (
    <p className="trk__updated">
      <span>{t('track.lastUpdate')}</span>
      {when.valid(facts.lastAt) && <strong>{when.full(facts.lastAt)}</strong>}
      {facts.live ? <em className="trk-pill trk-pill--green"><i />{t('track.live')}</em> : <em className={`trk-pill trk-pill--${facts.delivered ? 'green' : 'grey'}`}><i />{facts.courierStatus ? facts.statusLabel(facts.courierStatus) : t(`order.status.${order.status}`)}</em>}
      <button id="track-refresh" type="button" className="trk-round" onClick={onRefresh} disabled={busy} aria-label={t('track.refresh')}><RefreshGlyph /></button>
    </p>
  );
}

/** The whole answer for one order. Exported for the development preview (dev/ShipmentPreview). */
export function Result({ order, detailPath, contactPath }: { order: Shown; detailPath: string | null; contactPath: string }) {
  const { t } = useTranslation();
  const text = useLocalized();
  const when = useWhen();
  const facts = useFacts(order);
  const intl = useIntlLocale();
  const { tracking, map, delivered } = facts;
  const [copied, setCopied] = useState(false);
  const [allRows, setAllRows] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [full, setFull] = useState(false);

  // Full screen is this page's own: the map box covers the window, and Escape closes it.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; };
  }, [full]);

  const awb = tracking?.trackingNumber;
  const courier = tracking?.courier || order.shippingService.courier;
  const service = `${courier} ${text(order.shippingService.name)}`.trim();
  const statusText = facts.courierStatus ? facts.statusLabel(facts.courierStatus) : t(`order.status.${order.status}`);
  const pieces = order.items.reduce((sum, item) => sum + item.qty, 0);
  const weight = tracking?.parcel ? (tracking.parcel.weightGrams / 1000).toLocaleString(intl, { maximumFractionDigits: 1 }) : null;
  const parcelLine = tracking?.parcel && weight ? t('track.parcelLine', { count: tracking.parcel.count, weight }) : t('track.itemsLine', { count: pieces });
  const cancelled = order.status === 'cancelled';
  const hasMap = (!!map && (!!map.origin || !!map.destination || !!map.route)) || (tracking?.points.length ?? 0) > 0;
  const driver = tracking?.driver;
  const helpMessage = t('track.helpMessage', { number: order.number });
  const eta = !delivered && when.valid(map?.etaAt) ? map.etaAt : null;

  const copyAwb = async () => {
    if (!awb) return;
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the number stays selectable */ }
  };

  const arrival = delivered
    ? { label: t('track.card.deliveredOn'), value: when.valid(facts.deliveredAt) ? when.day(facts.deliveredAt) : '-', sub: when.valid(facts.deliveredAt) ? when.time(facts.deliveredAt) : '' }
    : { label: t('track.card.arrival'), value: eta ? when.day(eta) : t('checkout.eta', { days: order.shippingService.etaDays }), sub: eta ? t('track.usually', { days: order.shippingService.etaDays }) : '' };
  const distance = facts.totalKm === null ? null
    : facts.leftKm !== null && !delivered
      ? { value: t('track.kmLeft', { km: facts.leftKm }), sub: t(map?.route?.kind === 'straight' ? 'track.kmOfStraight' : 'track.kmOf', { km: facts.totalKm }) }
      : { value: t('track.kmTotal', { km: facts.totalKm }), sub: t('track.fromTo', { city: order.destination.city }) };

  return (
    <section className="trk-result" aria-labelledby="track-result-title">
      <h2 id="track-result-title" className="sr-only">{t('track.orderLabel', { number: order.number })}</h2>

      {cancelled && (
        <p className="trk-notice" role="status">{order.cancelReason === 'payment_expired' ? t('order.cancelReason.payment_expired') : t('order.status.cancelled')}</p>
      )}

      {/* Phones lead with one dark card: the status, the date that matters, and how far along. */}
      <div className="trk-hero" style={{ '--tone': TONE_COLOR[facts.tone === 'normal' ? 'green' : facts.tone] } as CSSProperties}>
        <p className="trk-hero__status">{delivered ? <CheckGlyph /> : <TruckGlyph />}<strong>{statusText}</strong>{facts.live && <em><i />{t('track.live')}</em>}</p>
        <p className="trk-hero__label">{arrival.label}</p>
        <p className="trk-hero__date">{delivered && when.valid(facts.deliveredAt) ? when.longDay(facts.deliveredAt) : eta ? when.longDay(eta) : arrival.value}</p>
        {map && <div className="trk-hero__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(map.progress * 100)} aria-label={t('track.progress')}><span style={{ width: `${Math.round(map.progress * 100)}%` }} /></div>}
        {when.valid(facts.lastAt) && <p className="trk-hero__updated">{t('track.updated', { date: when.full(facts.lastAt) })}</p>}
      </div>

      <dl className="trk-cards">
        <Card className="trk-card--status" icon={delivered ? <CheckGlyph /> : <TruckGlyph />} dark label={t('track.card.status')} value={statusText}
          sub={delivered ? '' : facts.live && map?.destination ? t('track.onTheWayTo', { city: map.destination.city }) : t(`track.headline.${order.status}`)} />
        <Card icon={<CalendarGlyph />} label={t('track.card.shipped')} value={when.valid(facts.pickedAt) ? when.day(facts.pickedAt) : t('track.notShipped')} sub={when.valid(facts.pickedAt) ? t('track.pickedUp', { time: when.time(facts.pickedAt) }) : ''} />
        <Card className="trk-card--arrival" icon={<ClockGlyph />} label={arrival.label} value={arrival.value} sub={arrival.sub} />
        <Card icon={<RouteGlyph />} label={t('track.card.distance')} value={distance?.value ?? '-'} sub={distance?.sub ?? ''} />
        <Card icon={<BoxGlyph />} label={t('track.card.service')} value={service} sub={parcelLine} />
        <div className="trk-card trk-card--awb">
          <dt>{t('track.awbShort')}</dt>
          <dd>{awb ? <><strong>{awb}</strong><button type="button" onClick={() => void copyAwb()}>{t(copied ? 'track.copied' : 'track.copy')}</button></> : <small>{t('track.awbPending')}</small>}</dd>
        </div>
      </dl>

      <div className="trk-grid">
        <div className="trk-main">
          <section className="trk-panel trk-panel--map" aria-labelledby="track-map-title">
            <header className="trk-panel__head">
              <h3 id="track-map-title"><MapGlyph />{t(delivered ? 'track.deliveryRoute' : 'track.liveTracking')}</h3>
              {hasMap && (
                <ul className="trk-legend" aria-hidden="true">
                  <li><i className="trk-legend__origin" />{t('track.legend.studio')}</li>
                  <li><i className="trk-legend__dest" />{t('track.legend.area')}</li>
                  {map?.vehicle && <li><i className="trk-legend__parcel" style={{ background: TONE_COLOR[map.tone] }} />{t('track.legend.courier')}</li>}
                  <li><i className="trk-legend__line" />{t('track.legend.covered')}</li>
                  {!delivered && <li><i className="trk-legend__dots" />{t('track.legend.remaining')}</li>}
                </ul>
              )}
            </header>
            {hasMap ? (
              <>
                <div className={`trk-map${full ? ' is-full' : ''}`}>
                  <ShipmentMap
                    map={map}
                    points={tracking?.points}
                    label={t('order.trackingMap')}
                    labels={{ origin: t('shipment.origin'), destination: map?.destination ? t('shipment.destinationArea', { city: map.destination.city }) : '', parcel: statusText }}
                  />
                  <button id="track-map-full" type="button" className="trk-map__full" onClick={() => setFull((v) => !v)} aria-pressed={full} aria-label={t(full ? 'track.exitFullscreen' : 'track.fullscreen')}><FullGlyph /></button>
                  {when.valid(facts.lastAt) && <p className="trk-map__chip"><PinGlyph />{t(delivered ? 'track.deliveredChip' : 'track.lastScan', { city: order.destination.city, time: when.time(facts.lastAt) })}</p>}
                </div>
                {map && (
                  <ul className="trk-map__notes">
                    {map.vehicle && !delivered && <li>{t('shipment.estimated')}</li>}
                    {map.route?.kind === 'straight' && <li>{t('shipment.straight')}</li>}
                    {map.destination && <li>{t(`shipment.precision.${map.destination.precision}`, { city: map.destination.city })}</li>}
                  </ul>
                )}
              </>
            ) : <p className="trk-panel__empty">{t(tracking?.status || tracking?.trackingNumber ? 'track.mapUnavailable' : 'track.mapPending')}</p>}
          </section>

          <section className="trk-panel" aria-labelledby="track-history-title">
            <header className="trk-panel__head">
              <h3 id="track-history-title"><ClockGlyph />{t('track.history')}</h3>
              {tracking?.link && <a id="track-courier-page" href={tracking.link} target="_blank" rel="noopener noreferrer">{t('track.viewOn', { courier })}<OutGlyph /></a>}
            </header>
            <div className="trk-table-wrap">
              <table className={`trk-table${allRows ? '' : ' is-short'}`}>
                <thead><tr><th>{t('track.col.date')}</th><th>{t('track.col.status')}</th><th>{t('track.col.update')}</th><th>{t('track.col.note')}</th></tr></thead>
                <tbody>
                  {facts.rows.map((row, index) => (
                    <tr key={row.key} className={index === 0 ? 'is-latest' : ''}>
                      <td className="trk-table__when">{when.valid(row.at) ? <><strong>{when.day(row.at)}</strong><small>{when.time(row.at)}</small></> : '-'}</td>
                      <td><span className={`trk-pill trk-pill--${row.tone}`}><i />{row.label}</span></td>
                      <td className="trk-table__text">{row.text || '-'}</td>
                      <td className="trk-table__note">{row.note || <span aria-hidden="true">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {facts.rows.length > FEW && (
              <button id="track-history-more" type="button" className="trk-more" onClick={() => setAllRows((v) => !v)} aria-expanded={allRows}>
                {allRows ? t('track.showFewer') : t('track.showAll', { count: facts.rows.length })}
              </button>
            )}
          </section>
          <p className="trk__note"><InfoGlyph />{t('track.timesNote')}</p>
        </div>

        <aside className="trk-side">
          <section className={`trk-panel trk-details${detailsOpen ? ' is-open' : ''}`} aria-labelledby="track-details-title">
            <header className="trk-panel__head">
              <h3 id="track-details-title"><BoxGlyph />{t('track.details')}</h3>
            </header>
            {/* On a phone the details fold into one row: a picture, how many pieces, and where to. */}
            <button id="track-details-toggle" type="button" className="trk-details__toggle" onClick={() => setDetailsOpen((v) => !v)} aria-expanded={detailsOpen} aria-controls="track-details-body">
              <span className="trk-details__thumb"><SmartImage src={order.items[0]?.image} alt="" category="ring" /></span>
              <span><strong>{t('track.details')}</strong><small>{t('track.detailsSummary', { count: pieces, city: order.destination.city })}</small></span>
              <ChevronGlyph />
            </button>
            <div id="track-details-body" className="trk-details__body">
              <dl className="trk-facts">
                <div><dt>{t('track.orderNo')}</dt><dd>{order.number}</dd></div>
                <div>
                  <dt>{t('track.awbShort')}</dt>
                  <dd>{awb ? <><span id="track-awb">{awb}</span><button id="track-copy" type="button" className="trk-copy" onClick={() => void copyAwb()} aria-label={t(copied ? 'track.copied' : 'track.copy')} title={t(copied ? 'track.copied' : 'track.copy')}>{copied ? <CheckGlyph /> : <CopyGlyph />}</button></> : <small>{t('track.awbPending')}</small>}</dd>
                </div>
                <div><dt>{t('track.shipFrom')}</dt><dd>{t('track.studio')}{map?.origin?.city && <small>{map.origin.city}, Indonesia</small>}</dd></div>
                <div><dt>{t('track.courier')}</dt><dd>{courier} · {text(order.shippingService.name)}</dd></div>
                <div className="trk-facts__wide">
                  <dt>{t('track.shipTo')}</dt>
                  {order.recipient ? (
                    <dd><span><strong>{order.recipient.name}</strong> · {order.recipient.phone}</span><small>{order.recipient.lines.join(', ')}</small></dd>
                  ) : (
                    <dd>{order.destination.city}, {order.destination.country}<small>{t('track.areaOnly')}</small></dd>
                  )}
                </div>
              </dl>
              <p className="trk-details__label">{t('track.inParcel')}</p>
              <ul className="trk-items">
                {order.items.map((item, index) => (
                  <li key={index}>
                    <div className="trk-items__media"><SmartImage src={item.image} alt="" category="ring" /></div>
                    <div><strong>{text(item.name)}</strong><span>{text(item.variantLabel)}</span></div>
                    <span>×{item.qty}</span>
                  </li>
                ))}
              </ul>
              <dl className="trk-stats">
                <div><dt>{t('track.parcels')}</dt><dd>{tracking?.parcel?.count ?? 1}</dd></div>
                <div><dt>{t('track.itemsCount')}</dt><dd>{pieces}</dd></div>
                {weight && <div><dt>{t('track.weight')}</dt><dd>{weight} kg</dd></div>}
              </dl>
              {detailPath && <NavLink id="track-detail" className="trk-details__more" to={detailPath}>{t('track.viewOrder')}</NavLink>}
            </div>
          </section>

          {driver && (
            <section className="trk-panel" aria-labelledby="track-courier-title">
              <header className="trk-panel__head"><h3 id="track-courier-title"><UserGlyph />{t('track.yourCourier')}</h3></header>
              <div className="trk-courier">
                <span className="trk-courier__avatar" aria-hidden="true">{driver.name.trim().charAt(0).toUpperCase()}</span>
                <p><strong>{driver.name}</strong><small>{t('track.courierOf', { courier })}{facts.courierStatus ? ` · ${facts.statusLabel(facts.courierStatus)}` : ''}</small></p>
                {/* The driver's number is given to the signed-in owner only. */}
                {driver.phone && <a id="track-call" className="trk-btn trk-btn--small" href={`tel:${driver.phone.replace(/[^\d+]/g, '')}`}><PhoneGlyph /><span>{t('track.call')}</span></a>}
              </div>
              <dl className="trk-stats">
                {driver.plateNumber && <div><dt>{t('track.plate')}</dt><dd>{driver.plateNumber}</dd></div>}
                <div><dt>{t('track.source')}</dt><dd>{courier}</dd></div>
              </dl>
            </section>
          )}

          <section className="trk-help" aria-labelledby="track-help-title">
            <h3 id="track-help-title">{t(delivered ? 'track.helpTitleDelivered' : 'track.helpTitle')}</h3>
            <p>{delivered ? t('track.helpBodyDelivered') : BRAND_CONTACT.isPlaceholder ? t('track.help') : t('track.helpBody', { hours: text(BRAND_CONTACT.hours) })}</p>
            <div>
              {BRAND_CONTACT.isPlaceholder ? (
                <NavLink id="track-help" className="trk-help__main" to={contactPath}>{t('track.help')}</NavLink>
              ) : (
                <>
                  <a id="track-help" className="trk-help__main" href={buildWhatsAppLink(helpMessage)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={18} />{t('track.whatsapp')}</a>
                  <a id="track-help-email" className="trk-help__mail" href={`mailto:${BRAND_CONTACT.email}?subject=${encodeURIComponent(helpMessage)}`} aria-label={t('track.emailUs')}><MailGlyph /></a>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Card({ icon, label, value, sub, dark, className = '' }: { icon: ReactNode; label: string; value: string; sub?: string; dark?: boolean; className?: string }) {
  return (
    <div className={`trk-card ${className}`}>
      <span className={`trk-card__icon${dark ? ' is-dark' : ''}`} aria-hidden="true">{icon}</span>
      <dt>{label}</dt>
      <dd><strong>{value}</strong>{sub && <small>{sub}</small>}</dd>
    </div>
  );
}

const LINE = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const SearchGlyph = () => <svg {...LINE}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
const LinkGlyph = () => <svg {...LINE}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
const RefreshGlyph = () => <svg {...LINE}><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" /></svg>;
const TruckGlyph = () => <svg {...LINE}><path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3v3.5h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>;
const CheckGlyph = () => <svg {...LINE}><path d="m5 12.5 4.5 4.5 9.5-10" /></svg>;
const CalendarGlyph = () => <svg {...LINE}><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>;
const ClockGlyph = () => <svg {...LINE}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
const RouteGlyph = () => <svg {...LINE}><circle cx="6.5" cy="17.5" r="2" /><circle cx="17.5" cy="6.5" r="2" /><path d="M8.5 17.5h6a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h6" /></svg>;
const BoxGlyph = () => <svg {...LINE}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></svg>;
const MapGlyph = () => <svg {...LINE}><path d="m3.5 6.5 5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13" /></svg>;
const FullGlyph = () => <svg {...LINE}><path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" /></svg>;
const PinGlyph = () => <svg {...LINE} width={15} height={15}><path d="M12 21s6.5-5.8 6.5-11a6.5 6.5 0 0 0-13 0c0 5.2 6.500 11 6.500 11z" /><circle cx="12" cy="10" r="2.2" /></svg>;
const OutGlyph = () => <svg {...LINE} width={14} height={14}><path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v5.5H4.5V7H10" /></svg>;
const InfoGlyph = () => <svg {...LINE} width={15} height={15}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></svg>;
const ChevronGlyph = () => <svg {...LINE} width={16} height={16}><path d="m6 9 6 6 6-6" /></svg>;
const CopyGlyph = () => <svg {...LINE} width={15} height={15}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M5.5 15.5h-1v-11h11v1" /></svg>;
const UserGlyph = () => <svg {...LINE}><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20c1.200-3.600 4.200-5.500 7.500-5.500s6.300 1.900 7.500 5.500" /></svg>;
const PhoneGlyph = () => <svg {...LINE} width={16} height={16}><path d="M5 4.5h3.5l1.500 4-2 1.500a11 11 0 0 0 6 6l1.500-2 4 1.500V19a1.500 1.500 0 0 1-1.500 1.500A15 15 0 0 1 3.500 6 1.500 1.500 0 0 1 5 4.500z" /></svg>;
const MailGlyph = () => <svg {...LINE}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
