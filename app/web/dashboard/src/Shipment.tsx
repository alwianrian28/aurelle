import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon } from './ui';
import { dateTime, idr } from './lib';
import type { AdminOrder, CourierRate, CourierTracking } from './types';

const ERROR: Record<string, string> = {
  shipping_not_configured: 'Courier booking is not set up yet: the Biteship API key is missing on the server.',
  shipping_origin_not_configured: 'The store’s pickup address is missing on the server (BITESHIP_ORIGIN_NAME, _PHONE, _ADDRESS and _POSTAL_CODE).',
  shipping_provider_unreachable: 'Biteship could not be reached. Try again in a moment.',
  postal_code_required: 'This address has no 5-digit postal code, which couriers need.',
  country_not_served: 'Courier booking covers addresses in Indonesia only. Enter the courier and tracking number by hand below.',
  not_allowed: 'Only a paid order that has not shipped yet can be booked.',
  already_booked: 'This order already has a shipment booked.',
  not_booked: 'No shipment is booked for this order yet.',
  network: 'Could not reach the server.',
};
/** Biteship's own words (a missing field, not enough balance) are more useful than ours. */
const explain = (res: { error: string; data?: Record<string, unknown> }) =>
  res.error === 'shipping_provider_error' ? `Biteship refused the request${res.data?.message ? `: ${String(res.data.message)}` : '.'}` : ERROR[res.error] ?? 'That did not work. Try again.';

const STATUS: Record<string, string> = {
  confirmed: 'Booked, finding a courier', allocated: 'Courier assigned', picking_up: 'Courier on the way to the store', picked: 'Picked up',
  in_transit: 'In transit', dropping_off: 'Out for delivery', delivered: 'Delivered', on_hold: 'On hold', rejected: 'Rejected by the courier',
  courier_not_found: 'No courier available', cancelled: 'Cancelled', return_in_transit: 'Being returned', returned: 'Returned', disposed: 'Disposed',
};
export const courierStatus = (status?: string | null) => (status ? STATUS[status] ?? status.replace(/_/g, ' ') : '');
const BOOKABLE = ['confirmed', 'preparing', 'ready_to_ship'];
/** A shipment that ended without reaching the customer: the order can be booked again. */
const ENDED = ['cancelled', 'rejected', 'courier_not_found', 'returned', 'disposed'];

/**
 * Courier booking for one order (Biteship). An order paid with a live courier rate is booked
 * on its own when the payment arrives; this panel shows that shipment, and books by hand when
 * that failed, when the shipment was cancelled, or when the customer chose a service from the
 * store's own list. Booking is charged to the store's Biteship balance, so the button names
 * the courier and the price.
 */
export default function Shipment({ order, onOrder }: { order: AdminOrder; onOrder: (order: AdminOrder) => void }) {
  const [rates, setRates] = useState<CourierRate[] | null>(null);
  const [pick, setPick] = useState('');
  const [collection, setCollection] = useState<'pickup' | 'drop_off'>('pickup');
  const [busy, setBusy] = useState<'' | 'rates' | 'book' | 'sync'>('');
  const [error, setError] = useState('');
  const [live, setLive] = useState<CourierTracking | null>(null);
  const base = `/admin/orders/${order.id}/biteship`;
  const booked = order.biteship?.orderId ? order.biteship : null;
  const tracking = order.tracking;
  const wanted = order.shippingService?.biteship;
  const keyOf = (r: { courier: string; service: string }) => `${r.courier}:${r.service}`;
  const canBook = order.paymentStatus === 'paid' && BOOKABLE.includes(order.status) && (!booked || ENDED.includes(tracking.status ?? ''));

  // The courier's scans and driver are not stored: they are read from Biteship when the panel opens.
  const bookedId = booked?.orderId;
  useEffect(() => {
    if (!bookedId) return;
    let gone = false;
    void api<{ tracking: CourierTracking }>(`${base}/tracking`).then((res) => { if (!gone && res.ok) setLive(res.data.tracking); });
    return () => { gone = true; };
  }, [base, bookedId, tracking.updatedAt]);

  const run = async (kind: 'book' | 'sync', path: string, body?: unknown) => {
    setBusy(kind);
    setError('');
    const res = await api<{ order: AdminOrder }>(path, { method: 'POST', body: body ?? {} });
    setBusy('');
    if (res.ok) { setRates(null); onOrder(res.data.order); } else setError(explain(res));
  };
  const loadRates = async () => {
    setBusy('rates');
    setError('');
    const res = await api<{ rates: CourierRate[] }>(`${base}/rates`);
    setBusy('');
    if (!res.ok) { setError(explain(res)); return; }
    setRates(res.data.rates);
    const first = res.data.rates.find((r) => wanted && keyOf(r) === keyOf(wanted)) ?? res.data.rates[0];
    setPick(first ? keyOf(first) : '');
  };
  const chosen = rates?.find((r) => keyOf(r) === pick);
  const history = live?.history ?? [];

  if (!booked && !canBook) return null;
  return (
    <div className="shipment">
      {booked && (
        <>
          <p className="shipment__state">
            <span className={`pill ${tracking.status === 'delivered' ? 'pill--green' : [...ENDED, 'on_hold'].includes(tracking.status ?? '') ? 'pill--red' : 'pill--blue'}`}>{courierStatus(tracking.status)}</span>
            <span>{(booked.courier ?? '').toUpperCase()} · {booked.service} · {idr(booked.priceIdr ?? 0)}{booked.insuranceIdr ? ` (insurance ${idr(booked.insuranceIdr)} included)` : ''}</span>
          </p>
          <div className="drawer__actions">
            <button type="button" id="admin-shipment-sync" className="btn" disabled={busy !== ''} onClick={() => void run('sync', `${base}/sync`)}><Icon name="truck" />{busy === 'sync' ? 'Checking…' : 'Refresh status'}</button>
            {tracking.link && <a className="btn" href={tracking.link} target="_blank" rel="noreferrer"><Icon name="external" />Courier tracking page</a>}
          </div>
          {live?.driver && <p className="muted">Driver: {live.driver.name}{live.driver.phone ? ` · ${live.driver.phone}` : ''}{live.driver.plateNumber ? ` · ${live.driver.plateNumber}` : ''}</p>}
          {history.length > 0 && (
            <ol className="lines">
              {[...history].reverse().map((h, i) => <li key={i}><span><strong>{courierStatus(h.status)}</strong>{h.note && `: ${h.note}`}<small>{h.at ? dateTime(h.at) : ''}</small></span></li>)}
            </ol>
          )}
          <p className="muted">Biteship reference {booked.reference}{tracking.updatedAt ? ` · last checked ${dateTime(tracking.updatedAt)}` : ''}. Updates also arrive on their own.</p>
        </>
      )}

      {/* The booking made when the payment arrived did not go through. */}
      {!booked && order.biteship?.error && <p className="notice notice--error" role="alert">The courier could not be booked automatically: {order.biteship.error}</p>}

      {canBook && (!rates ? (
        <div className="drawer__actions">
          {!booked && wanted && (
            <button type="button" id="admin-shipment-retry" className="btn btn--primary" disabled={busy !== ''} onClick={() => void run('book', base)}>
              {busy === 'book' ? 'Booking…' : `${order.biteship?.error ? 'Try again: book' : 'Book'} ${order.shippingService?.courier} ${order.shippingService?.name.en}`}
            </button>
          )}
          <button type="button" id="admin-shipment-rates" className={!booked && wanted ? 'btn' : 'btn btn--primary'} disabled={busy !== ''} onClick={() => void loadRates()}>
            {busy === 'rates' ? 'Getting rates…' : booked ? 'Book again' : wanted ? 'Choose another courier' : 'Book a courier'}
          </button>
        </div>
      ) : rates.length === 0 ? <p className="muted">No courier serves this address. Enter the courier and tracking number by hand below.</p> : (
        <>
          <fieldset className="shipment__rates" aria-label="Courier service">
            {rates.map((r) => (
              <label key={keyOf(r)} className={keyOf(r) === pick ? 'is-selected' : undefined}>
                <input type="radio" name="courier-rate" checked={keyOf(r) === pick} onChange={() => setPick(keyOf(r))} />
                <span><strong>{r.courierName} · {r.serviceName}</strong><small>{r.eta ? `${r.eta} ${r.etaUnit}` : r.description}{wanted && keyOf(r) === keyOf(wanted) ? ' · chosen by the customer' : ''}</small></span>
                <span>{idr(r.priceIdr)}</span>
              </label>
            ))}
          </fieldset>
          {chosen && chosen.collection.includes('drop_off') && chosen.collection.includes('pickup') && (
            <label className="shipment__collect">Hand-over
              <select value={collection} onChange={(e) => setCollection(e.target.value as 'pickup' | 'drop_off')}>
                <option value="pickup">Courier picks up at the store</option>
                <option value="drop_off">We drop the parcel at a counter</option>
              </select>
            </label>
          )}
          <div className="drawer__actions">
            <button type="button" id="admin-shipment-book" className="btn btn--primary" disabled={!chosen || busy !== ''}
              onClick={() => chosen && void run('book', base, { courier: chosen.courier, service: chosen.service, collection: chosen.collection.includes(collection) ? collection : chosen.collection[0] ?? 'pickup' })}>
              {busy === 'book' ? 'Booking…' : chosen ? `Book ${chosen.courierName} ${chosen.serviceName} · ${idr(chosen.priceIdr)}` : 'Book'}
            </button>
            <button type="button" className="btn" disabled={busy !== ''} onClick={() => setRates(null)}>Cancel</button>
          </div>
          <p className="muted">Prices include insurance for the goods’ full value. Booking is charged to the store’s Biteship balance and gives this order its tracking number.</p>
        </>
      ))}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </div>
  );
}
