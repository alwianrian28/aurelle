import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { ExportMenu, FulfillmentPill, Icon, MenuItem, Pager, PaymentPill, Popover, Select, Tabs, Thumb } from './ui';
import { ACTION, PAGE, PAYMENT, STATUS, dateTime, fulfillment, idr, plural, dateOnly, dayBounds, dayOf, printPackingSlip, rangeStart, stageOf } from './lib';
import type { Stage } from './lib';
import type { Report } from './export';
import type { AdminOrder, Go, Route } from './types';
import Shipment from './Shipment';

// The map library is large and only needed once an order is opened.
const TrackingMap = lazy(() => import('./TrackingMap'));

type Tab = 'all' | Stage;
type Pay = 'all' | 'paid' | 'awaiting' | 'failed';
type Range = 'today' | '7' | '30' | 'all' | 'custom';
const TABS: [Tab, string][] = [['all', 'All'], ['awaiting', 'Awaiting payment'], ['toship', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
const RANGE: Record<Exclude<Range, 'custom'>, string> = { today: 'today', 7: 'in the last 7 days', 30: 'in the last 30 days', all: 'in total' };
const actor = (a?: string) => (!a ? '' : a.startsWith('admin:') ? 'Admin' : a === 'customer' ? 'Customer' : a === 'system' ? 'System' : a === 'biteship' ? 'Courier (Biteship)' : 'Payment gateway');
const place = (o: AdminOrder) => [o.addressSnapshot.city, o.addressSnapshot.country].filter(Boolean).join(', ');

/**
 * Order desk: every order with its payment and fulfilment state, filters, and the next step
 * for each one. The API decides which steps are allowed; the menu only offers those.
 */
export default function Orders({ orders, setOrders, reload, route, go }: {
  orders: AdminOrder[]; setOrders: React.Dispatch<React.SetStateAction<AdminOrder[]>>; reload: () => Promise<void>; route: Route; go: Go;
}) {
  const [tab, setTab] = useState<Tab>(TABS.some(([t]) => t === route.tab) ? (route.tab as Tab) : 'all');
  const [query, setQuery] = useState(route.q ?? '');
  const [pay, setPay] = useState<Pay>('all');
  // Arriving from a link ("to ship", a customer's orders) must not hide older matches.
  const [range, setRange] = useState<Range>(route.q || route.tab ? 'all' : '30');
  // The two ends of a custom period, as calendar days. Both are included.
  const [from, setFrom] = useState(() => dayOf(30));
  const [to, setTo] = useState(() => dayOf());
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE);
  const [picked, setPicked] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const selected = orders.find((o) => o.id === route.id) ?? null;
  const open = (id?: string) => go({ ...route, id });

  /** Runs an admin action and puts the returned order back into the list. */
  const act = async (path: string, method: string, body?: unknown) => {
    setNotice(null);
    const res = await api<{ order: AdminOrder }>(path, { method, body });
    if (res.ok) setOrders((list) => list.map((o) => (o.id === res.data.order.id ? res.data.order : o)));
    else setNotice({ tone: 'error', text: res.error === 'invalid_transition' ? 'This step is not available yet (check the payment status).' : res.error === 'invalid_input' ? 'The details are incomplete or invalid.' : 'Could not save. Try again.' });
    void reload();
    return res.ok;
  };

  const q = query.trim().toLowerCase();
  // A period typed backwards (from after to) is read the way it was meant.
  const [first, last] = from <= to ? [from, to] : [to, from];
  const [since, until] = range === 'custom' ? [dayBounds(first)[0], dayBounds(last)[1]] : [rangeStart(range), Infinity];
  const inRange = orders.filter((o) => { const at = new Date(o.createdAt).getTime(); return at >= since && at <= until; });
  const period = range === 'custom' ? (first === last ? `on ${dateOnly(`${first}T00:00:00`)}` : `from ${dateOnly(`${first}T00:00:00`)} to ${dateOnly(`${last}T00:00:00`)}`) : RANGE[range];
  const base = inRange.filter((o) => (
    (!q || [o.number, o.customer?.name, o.customer?.email].some((t) => t?.toLowerCase().includes(q)))
    && (pay === 'all' || (pay === 'paid' ? o.paymentStatus === 'paid' : pay === 'awaiting' ? ['unpaid', 'pending'].includes(o.paymentStatus) : ['failed', 'expired'].includes(o.paymentStatus)))
  ));
  const shown = tab === 'all' ? base : base.filter((o) => stageOf(o.status) === tab);
  const rows = shown.slice(page * size, (page + 1) * size);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); setPicked([]); };
  const allPicked = rows.length > 0 && rows.every((o) => picked.includes(o.id));

  /** The orders on screen (all pages of the current filters), or only the ticked ones. */
  const report = (): Report => {
    const list = picked.length ? shown.filter((o) => picked.includes(o.id)) : shown;
    const filters = [tab !== 'all' && TABS.find(([key]) => key === tab)?.[1], pay !== 'all' && { paid: 'paid', awaiting: 'awaiting payment', failed: 'failed or expired' }[pay], q && `matching "${query.trim()}"`].filter(Boolean);
    return {
      file: 'aurelle-orders',
      title: 'Orders',
      subtitle: `${picked.length ? `${plural(list.length, 'selected order')}` : `${plural(list.length, 'order')} ${period}`}${filters.length ? ` (${filters.join(', ')})` : ''}`,
      columns: [
        { header: 'Order', width: 21 }, { header: 'Date', kind: 'datetime', width: 19 }, { header: 'Customer', width: 22 }, { header: 'Email', width: 30, wide: true },
        { header: 'Destination', width: 24 }, { header: 'Items', width: 44, flex: true }, { header: 'Pieces', kind: 'int', width: 9, wide: true }, { header: 'Total', kind: 'money', width: 16 },
        { header: 'Payment', width: 18 }, { header: 'Fulfillment', width: 16 }, { header: 'Courier', width: 14, wide: true }, { header: 'Tracking no.', width: 20, wide: true },
      ],
      rows: list.map((o) => [
        o.number, o.createdAt, o.customer?.name ?? '', o.customer?.email ?? '', place(o),
        o.items.map((i) => `${i.qty} x ${i.name.en}${i.variantLabel?.en ? ` (${i.variantLabel.en})` : ''}`).join(', '), o.items.reduce((n, i) => n + i.qty, 0), o.costs.total,
        PAYMENT[o.paymentStatus] ?? o.paymentStatus, fulfillment(o.status), o.tracking.courier ?? '', o.tracking.trackingNumber ?? '',
      ]),
      totals: ['Total', null, plural(list.length, 'order'), null, null, null, list.reduce((n, o) => n + o.items.reduce((m, i) => m + i.qty, 0), 0), list.reduce((n, o) => n + o.costs.total, 0), null, null, null, null],
    };
  };
  const copy = async (o: AdminOrder) => {
    try { await navigator.clipboard.writeText(o.number); setNotice({ tone: 'ok', text: `${o.number} copied.` }); } catch { setNotice({ tone: 'error', text: 'Could not copy. Select the number and copy it by hand.' }); }
  };
  const step = (o: AdminOrder, status: AdminOrder['status']) => {
    if (status === 'cancelled' && !window.confirm(`Cancel order ${o.number}? Its stock goes back on sale. This cannot be undone.`)) return;
    void act(`/admin/orders/${o.id}`, 'PATCH', { status });
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Orders</h1><p id="orders-period">{plural(inRange.length, 'order')} {period}</p></div>
        <div className="page-head__actions"><ExportMenu id="orders-export" report={report} disabled={shown.length === 0} /></div>
      </div>
      {notice && !selected && <p className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      <section className="card card--flush">
        <Tabs label="Orders by stage" value={tab} onChange={reset(setTab)} tabs={TABS.map(([key, text]) => [key, text, key === 'all' ? base.length : base.filter((o) => stageOf(o.status) === key).length])} />
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input id="orders-search" type="search" value={query} onChange={(e) => reset(setQuery)(e.target.value)} placeholder="Search by order no., customer or email" aria-label="Search orders" /></label>
          <Select id="orders-payment" label="Payment" value={pay} onChange={reset(setPay)} options={[['all', 'All'], ['paid', 'Paid'], ['awaiting', 'Awaiting payment'], ['failed', 'Failed or expired']]} />
          <Select id="orders-date" label="Date" value={range} onChange={reset(setRange)} options={[['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time'], ['custom', 'Custom period']]} />
          {range === 'custom' && (
            <div className="dates" role="group" aria-label="Custom period">
              <label>From<input id="orders-from" type="date" value={from} max={dayOf()} onChange={(e) => { if (e.target.value) reset(setFrom)(e.target.value); }} /></label>
              <label>To<input id="orders-to" type="date" value={to} max={dayOf()} onChange={(e) => { if (e.target.value) reset(setTo)(e.target.value); }} /></label>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table className="table table--cards t-orders">
            <thead>
              <tr>
                <th className="check"><input type="checkbox" aria-label="Select all orders on this page" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...rows.map((o) => o.id)])] : picked.filter((id) => !rows.some((o) => o.id === id)))} /></th>
                <th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th><span className="sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={o.id === route.id ? 'is-selected' : ''}>
                  <td className="check"><input type="checkbox" aria-label={`Select ${o.number}`} checked={picked.includes(o.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, o.id] : picked.filter((id) => id !== o.id))} /></td>
                  <td><button type="button" className="table__key" onClick={() => open(o.id)}>{o.number}</button></td>
                  <td className="soft nowrap">{dateTime(o.createdAt)}</td>
                  <td>{o.customer?.name ?? '—'}<small>{place(o)}</small></td>
                  <td><span className="thumbs" aria-label={o.items.map((i) => `${i.qty} × ${i.name.en}`).join(', ')}>{o.items.slice(0, 3).map((i) => <Thumb key={i.variantId} src={i.image} size={32} />)}{o.items.length > 3 && <small>+{o.items.length - 3}</small>}</span></td>
                  <td className="nowrap">{idr(o.costs.total)}</td>
                  <td><PaymentPill status={o.paymentStatus} /></td>
                  <td><FulfillmentPill status={o.status} /></td>
                  <td className="end">
                    <Popover id={`order-menu-${o.id}`} label={`Actions for ${o.number}`} className="btn btn--icon btn--ghost" panelClass="menu" trigger={<Icon name="more" size={18} />}>
                      {(close) => (
                        <>
                          <MenuItem icon="eye" onClick={() => { close(); open(o.id); }}>View details</MenuItem>
                          {o.nextStatuses.filter((s) => s !== 'cancelled').map((s) => <MenuItem key={s} icon={s === 'delivered' ? 'check' : s === 'shipped' ? 'truck' : 'box'} onClick={() => { close(); step(o, s); }}>{ACTION[s] ?? STATUS[s]}</MenuItem>)}
                          <MenuItem icon="printer" onClick={() => { close(); if (!printPackingSlip(o)) setNotice({ tone: 'error', text: 'The browser blocked the packing slip window. Allow pop-ups for this page.' }); }}>Print packing slip</MenuItem>
                          <MenuItem icon="copy" onClick={() => { close(); void copy(o); }}>Copy order number</MenuItem>
                          {o.nextStatuses.includes('cancelled') && <><hr /><MenuItem icon="x" danger onClick={() => { close(); step(o, 'cancelled'); }}>Cancel order</MenuItem></>}
                        </>
                      )}
                    </Popover>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="empty">{orders.length === 0 ? 'No orders yet. New checkouts appear here on their own.' : 'No orders match these filters.'}</p>}
        </div>
        <Pager id="orders" page={page} total={shown.length} size={size} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); setPicked([]); }} />
      </section>

      {selected && <OrderPanel key={selected.id} order={selected} notice={notice?.tone === 'error' ? notice.text : ''} act={act} step={step} onClose={() => open(undefined)}
        onOrder={(next) => { setOrders((list) => list.map((o) => (o.id === next.id ? next : o))); void reload(); }} />}
    </>
  );
}

/** Everything about one order, in a drawer over the list: next step, customer, items, shipment, history. */
function OrderPanel({ order, notice, act, step, onClose, onOrder }: {
  order: AdminOrder; notice: string; onClose: () => void; onOrder: (order: AdminOrder) => void;
  act: (path: string, method: string, body?: unknown) => Promise<boolean>;
  step: (o: AdminOrder, status: AdminOrder['status']) => void;
}) {
  const tracking = order.tracking;
  const [courier, setCourier] = useState(tracking.courier ?? '');
  const [awb, setAwb] = useState(tracking.trackingNumber ?? '');
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const base = `/admin/orders/${order.id}`;
  const a = order.addressSnapshot;
  const panel = useRef<HTMLElement>(null);

  useEffect(() => { panel.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="drawer" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={panel} className="drawer__panel" role="dialog" aria-modal="true" aria-label={`Order ${order.number}`} tabIndex={-1}>
        <div className="drawer__head">
          <div><h2>{order.number}</h2><p>{dateTime(order.createdAt)}</p></div>
          <button type="button" id="order-close" className="btn btn--icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {notice && <p className="notice notice--error" role="alert">{notice}</p>}

        <section>
          <h3>Status</h3>
          <p className="drawer__pills"><PaymentPill status={order.paymentStatus} /><FulfillmentPill status={order.status} /></p>
          <div className="drawer__actions">
            {order.nextStatuses.map((s) => (
              <button key={s} type="button" id={`admin-set-${s}`} className={s === 'cancelled' ? 'btn btn--danger' : 'btn btn--primary'} onClick={() => step(order, s)}>{ACTION[s] ?? STATUS[s]}</button>
            ))}
            <button type="button" className="btn" onClick={() => printPackingSlip(order)}><Icon name="printer" />Packing slip</button>
          </div>
          {order.nextStatuses.length === 0 && <p className="muted">No further steps for this order.</p>}
          {order.status === 'confirmed' && order.paymentStatus !== 'paid' && <p className="muted">The order can be processed once it is paid.</p>}
        </section>

        <section>
          <h3>Customer & address</h3>
          <p>{order.customer?.name} · {order.customer?.email}{order.customer?.phone ? ` · ${order.customer.phone}` : ''}</p>
          <address>{[a.recipient, a.line1, a.line2, [a.city, a.state, a.postalCode].filter(Boolean).join(', '), a.country].filter(Boolean).join('\n')}</address>
        </section>

        <section>
          <h3>Items</h3>
          <ul className="lines">
            {order.items.map((i) => <li key={i.variantId}><Thumb src={i.image} size={40} /><span>{i.qty} × {i.name.en}<small>{i.variantLabel?.en}</small></span><span>{idr(i.qty * i.unitPriceIdr)}</span></li>)}
            <li><span>Shipping{order.shippingService ? ` · ${order.shippingService.courier}` : ''}</span><span>{idr(order.costs.shipping)}</span></li>
            {order.costs.tax + order.costs.duty + order.costs.other > 0 && <li><span>Tax, duty & other</span><span>{idr(order.costs.tax + order.costs.duty + order.costs.other)}</span></li>}
            <li className="is-total"><span>Total</span><span>{idr(order.costs.total)}</span></li>
          </ul>
        </section>

        <section>
          <h3>Shipping & tracking</h3>
          <Shipment order={order} onOrder={(next) => { setCourier(next.tracking.courier ?? ''); setAwb(next.tracking.trackingNumber ?? ''); onOrder(next); }} />
          <form className="row" onSubmit={(e) => { e.preventDefault(); void act(`${base}/shipment`, 'PUT', { courier, trackingNumber: awb }); }}>
            <label>Courier<input id="admin-courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. DHL" /></label>
            <label>Tracking no.<input id="admin-awb" value={awb} onChange={(e) => setAwb(e.target.value)} /></label>
            <button type="submit" id="admin-save-shipment" className="btn btn--primary">Save</button>
          </form>
          <p className="muted">Click the map to pick a checkpoint location, name it, then add it.</p>
          <Suspense fallback={<div className="tracking-map tracking-map--loading">Loading map…</div>}>
            <TrackingMap points={tracking.points} draft={draft} onPick={(lat, lng) => setDraft({ lat, lng })} label="Tracking map: click to pick a location" />
          </Suspense>
          <form className="row" onSubmit={async (e) => {
            e.preventDefault();
            if (!draft) return;
            if (await act(`${base}/tracking`, 'POST', { label, note, ...draft })) { setDraft(null); setLabel(''); setNote(''); }
          }}>
            <label>Location<input id="admin-point-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Jakarta warehouse" required minLength={2} /></label>
            <label>Note<input id="admin-point-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
            <button type="submit" id="admin-add-point" className="btn btn--primary" disabled={!draft}>{draft ? 'Add checkpoint' : 'Pick a point'}</button>
          </form>
          <ol className="lines">
            {tracking.points.map((p) => (
              <li key={p.id}><span><strong>{p.label}</strong>{p.note && `: ${p.note}`}<small>{dateTime(p.at)}</small></span>
                <button type="button" className="link link--danger" aria-label={`Remove checkpoint ${p.label}`} onClick={() => void act(`${base}/tracking/${p.id}`, 'DELETE')}>Remove</button></li>
            ))}
          </ol>
        </section>

        <section>
          <h3>History</h3>
          <ol className="lines">
            {order.history.map((h, i) => <li key={i}><span>{STATUS[h.status]} · {PAYMENT[h.paymentStatus] ?? h.paymentStatus}<small>{dateTime(h.at)} · {actor(h.actor)}</small></span></li>)}
          </ol>
        </section>
      </aside>
    </div>
  );
}
