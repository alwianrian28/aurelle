import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import TrackingMap from './TrackingMap';
import AdminProducts from './AdminProducts';
import Overview from './Overview';
import type { AdminOrder, OrderStatus, User } from './types';
import './Admin.css';

type ReadyStockOrderStatus = OrderStatus;
interface Summary { today: number; awaitingPayment: number; toProcess: number; shipped: number; paidTotalIdr: number }

const STATUS: Record<ReadyStockOrderStatus, string> = {
  awaiting_payment: 'Awaiting payment', confirmed: 'Confirmed', preparing: 'Preparing', ready_to_ship: 'Ready to ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', pending_decision: 'Needs decision',
};
const PAYMENT: Record<string, string> = {
  unpaid: 'Unpaid', pending: 'Awaiting confirmation', partial: 'Partial', paid: 'Paid', failed: 'Failed',
  expired: 'Expired', review_finance: 'Finance review', refund_pending: 'Refund in progress', refunded: 'Refunded',
};
const ACTION: Partial<Record<ReadyStockOrderStatus, string>> = {
  confirmed: 'Confirm', preparing: 'Start preparing', ready_to_ship: 'Mark ready to ship', shipped: 'Mark shipped', delivered: 'Mark delivered', cancelled: 'Cancel order',
};
const FILTERS: ('' | ReadyStockOrderStatus)[] = ['', 'awaiting_payment', 'confirmed', 'preparing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];

const idr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const actor = (a?: string) => (!a ? '' : a.startsWith('admin:') ? 'Admin' : a === 'customer' ? 'Customer' : a === 'system' ? 'System' : 'Gateway (demo)');

/**
 * Admin order desk. Online orders arrive here as soon as checkout creates them (polled every
 * 10 s). Access is decided by the API (role = admin); this screen only reflects it.
 */
export default function Admin({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [filter, setFilter] = useState<'' | ReadyStockOrderStatus>('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'offline'>('loading');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<'overview' | 'orders' | 'products'>('overview');

  const load = useCallback(async () => {
    const res = await api<{ orders: AdminOrder[]; summary: Summary }>(`/admin/orders${filter ? `?status=${filter}` : ''}`);
    if (res.ok) { setOrders(res.data.orders); setSummary(res.data.summary); setState('ready'); }
    else setState(res.status === 0 ? 'offline' : 'forbidden');
  }, [filter]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 10_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [load]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;
  /** Runs an admin action and puts the returned order back into the list. */
  const act = async (path: string, method: string, body?: unknown) => {
    setNotice('');
    const res = await api<{ order: AdminOrder }>(path, { method, body });
    if (res.ok) setOrders((list) => list.map((o) => (o.id === res.data.order.id ? res.data.order : o)));
    else setNotice(res.error === 'invalid_transition' ? 'This step is not available yet (check the payment status).' : res.error === 'invalid_input' ? 'The details are incomplete or invalid.' : 'Could not save. Try again.');
    void load();
    return res.ok;
  };

  return (
    <div className="admin">
      <header className="admin__bar">
        <span className="admin__brand">AURELLE <small>Admin</small></span>
        <nav><a href={import.meta.env.VITE_SHOP_URL ?? 'http://localhost:5173/store'}>View store</a><span>{user.email}</span><button type="button" id="admin-logout" onClick={onLogout}>Sign out</button></nav>
      </header>

      {state === 'forbidden' && <p className="admin__empty" role="alert">This account does not have admin access.</p>}
      {state === 'offline' && <p className="admin__empty" role="alert">Could not reach the server. Make sure the API is running.</p>}
      {state === 'loading' && <p className="admin__empty">Loading…</p>}

      {state === 'ready' && (
        <div className="admin__shell">
        <nav className="admin__side" aria-label="Dashboard sections">
          <button type="button" id="admin-view-overview" aria-current={view === 'overview' ? 'page' : undefined} onClick={() => setView('overview')}>Overview</button>
          <button type="button" id="admin-view-orders" aria-current={view === 'orders' ? 'page' : undefined} onClick={() => setView('orders')}>Orders{summary && summary.toProcess > 0 ? <span className="admin__count">{summary.toProcess}</span> : null}</button>
          <button type="button" id="admin-view-products" aria-current={view === 'products' ? 'page' : undefined} onClick={() => setView('products')}>Products, prices & stock</button>
        </nav>
        <main className="admin__main">
          {view === 'overview' ? <Overview onOpenOrders={() => setView('orders')} onOpenProducts={() => setView('products')} /> : view === 'products' ? <><h1 className="admin__title">Products, prices & stock</h1><AdminProducts /></> : <>
          <h1 className="admin__title">Orders</h1>
          {summary && (
            <dl className="admin__tiles">
              <div><dt>Received today</dt><dd id="tile-today">{summary.today}</dd></div>
              <div><dt>Awaiting payment</dt><dd>{summary.awaitingPayment}</dd></div>
              <div><dt>To process</dt><dd id="tile-process">{summary.toProcess}</dd></div>
              <div><dt>In transit</dt><dd>{summary.shipped}</dd></div>
              <div><dt>Total paid</dt><dd>{idr(summary.paidTotalIdr)}</dd></div>
            </dl>
          )}
          <div className="admin__filters" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f ? STATUS[f] : 'All'}</button>)}
          </div>

          <div className="admin__split">
            <div className="admin__table">
              <table>
                <thead><tr><th>Order no.</th><th>Time</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className={o.id === selectedId ? 'is-selected' : ''}>
                      <td><button type="button" className="admin__link" onClick={() => setSelectedId(o.id)}>{o.number}</button></td>
                      <td>{when(o.createdAt)}</td>
                      <td>{o.customer?.name}<br /><small>{o.customer?.email}</small></td>
                      <td>{idr(o.costs.total)}</td>
                      <td><span className={`admin__pill admin__pill--${o.paymentStatus}`}>{PAYMENT[o.paymentStatus] ?? o.paymentStatus}</span></td>
                      <td><span className={`admin__pill admin__pill--${o.status}`}>{STATUS[o.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <p className="admin__empty">No orders yet.</p>}
            </div>

            {selected && <OrderPanel key={selected.id} order={selected} notice={notice} act={act} onClose={() => setSelectedId(null)} />}
          </div>
          </>}
        </main>
        </div>
      )}
    </div>
  );
}

function OrderPanel({ order, notice, act, onClose }: {
  order: AdminOrder; notice: string; onClose: () => void;
  act: (path: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const tracking = order.tracking;
  const [courier, setCourier] = useState(tracking.courier ?? '');
  const [awb, setAwb] = useState(tracking.trackingNumber ?? '');
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const base = `/admin/orders/${order.id}`;
  const a = order.addressSnapshot;

  return (
    <aside className="admin__panel" aria-label={`Order ${order.number}`}>
      <div className="admin__panel-head">
        <div><h2>{order.number}</h2><p>{when(order.createdAt)}</p></div>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
      {notice && <p className="admin__notice" role="alert">{notice}</p>}

      <section>
        <h3>Actions</h3>
        <p><span className={`admin__pill admin__pill--${order.status}`}>{STATUS[order.status]}</span> <span className={`admin__pill admin__pill--${order.paymentStatus}`}>{PAYMENT[order.paymentStatus] ?? order.paymentStatus}</span></p>
        <div className="admin__actions">
          {order.nextStatuses.map((s) => (
            <button key={s} type="button" id={`admin-set-${s}`} className={s === 'cancelled' ? 'is-danger' : ''} onClick={() => void act(base, 'PATCH', { status: s })}>{ACTION[s] ?? STATUS[s]}</button>
          ))}
          {order.nextStatuses.length === 0 && <small>No further actions.</small>}
        </div>
        {order.status === 'confirmed' && order.paymentStatus !== 'paid' && <small>The order can be processed once it is paid.</small>}
      </section>

      <section>
        <h3>Customer & address</h3>
        <p>{order.customer?.name} · {order.customer?.email}{order.customer?.phone ? ` · ${order.customer.phone}` : ''}</p>
        <address>{[a.recipient, a.line1, a.line2, [a.city, a.state, a.postalCode].filter(Boolean).join(', '), a.country].filter(Boolean).join('\n')}</address>
      </section>

      <section>
        <h3>Items</h3>
        <ul className="admin__items">
          {order.items.map((i) => <li key={i.variantId}><span>{i.qty} × {i.name.en}<small>{i.variantLabel?.en}</small></span><span>{idr(i.qty * i.unitPriceIdr)}</span></li>)}
          <li><span>Shipping</span><span>{idr(order.costs.shipping)}</span></li>
          {order.costs.tax + order.costs.duty + order.costs.other > 0 && <li><span>Tax, duty & other</span><span>{idr(order.costs.tax + order.costs.duty + order.costs.other)}</span></li>}
          <li className="is-total"><span>Total</span><span>{idr(order.costs.total)}</span></li>
        </ul>
      </section>

      <section>
        <h3>Shipping & tracking</h3>
        <form className="admin__row" onSubmit={(e) => { e.preventDefault(); void act(`${base}/shipment`, 'PUT', { courier, trackingNumber: awb }); }}>
          <label>Courier<input id="admin-courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. DHL" /></label>
          <label>Tracking no.<input id="admin-awb" value={awb} onChange={(e) => setAwb(e.target.value)} /></label>
          <button type="submit" id="admin-save-shipment">Save</button>
        </form>
        <p className="admin__hint">Click the map to pick a checkpoint location, name it, then add it.</p>
        <TrackingMap points={tracking.points} draft={draft} onPick={(lat, lng) => setDraft({ lat, lng })} label="Tracking map: click to pick a location" />
        <form className="admin__row" onSubmit={async (e) => {
          e.preventDefault();
          if (!draft) return;
          if (await act(`${base}/tracking`, 'POST', { label, note, ...draft })) { setDraft(null); setLabel(''); setNote(''); }
        }}>
          <label>Location<input id="admin-point-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Jakarta warehouse" required minLength={2} /></label>
          <label>Note<input id="admin-point-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></label>
          <button type="submit" id="admin-add-point" disabled={!draft}>{draft ? 'Add checkpoint' : 'Pick a point on the map'}</button>
        </form>
        <ol className="admin__points">
          {tracking.points.map((p) => (
            <li key={p.id}><span><strong>{p.label}</strong>{p.note && `: ${p.note}`}<small>{when(p.at)}</small></span>
              <button type="button" aria-label={`Remove checkpoint ${p.label}`} onClick={() => void act(`${base}/tracking/${p.id}`, 'DELETE')}>Remove</button></li>
          ))}
        </ol>
      </section>

      <section>
        <h3>History</h3>
        <ol className="admin__history">
          {order.history.map((h, i) => <li key={i}><span>{STATUS[h.status]} · {PAYMENT[h.paymentStatus] ?? h.paymentStatus}</span><small>{when(h.at)} · {actor(h.actor)}</small></li>)}
        </ol>
      </section>
    </aside>
  );
}
