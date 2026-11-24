import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { OrderStatus } from './types';

interface OverviewData {
  today: { orders: number; paidIdr: number };
  week: { orders: number; paidIdr: number };
  awaitingPayment: number;
  toProcess: number;
  shipped: number;
  customers: number;
  daily: { date: string; orders: number; paidIdr: number }[];
  lowStock: { sku: string; product: string; variant: string; available: number }[];
  lowStockTotal: number;
  topProducts: { product: string; variant: string; qty: number }[];
  latestOrders: { id: string; number: string; status: OrderStatus; paymentStatus: string; totalIdr: number; createdAt: string }[];
}

const STATUS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment', confirmed: 'Confirmed', preparing: 'Preparing', ready_to_ship: 'Ready to ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', pending_decision: 'Needs decision',
};
const idr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
/** Compact rupiah for axis and bar labels: 3.7M / 850K. */
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Dashboard home: today's numbers, 7-day revenue, and what needs attention. Refreshes every 30 s. */
export default function Overview({ onOpenOrders, onOpenProducts }: { onOpenOrders: () => void; onOpenProducts: () => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await api<OverviewData>('/admin/overview');
    setFailed(!res.ok);
    if (res.ok) setData(res.data);
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [load]);

  if (!data) return <p className="admin__empty" role={failed ? 'alert' : undefined}>{failed ? 'Could not load the overview. Make sure the backend is running.' : 'Loading…'}</p>;

  return (
    <>
      <h1 className="admin__title">Overview</h1>
      <dl className="admin__tiles admin__tiles--overview">
        <div><dt>Revenue today</dt><dd id="kpi-today">{idr(data.today.paidIdr)}</dd><small>{data.today.orders} orders received</small></div>
        <div><dt>Revenue, 7 days</dt><dd>{idr(data.week.paidIdr)}</dd><small>{data.week.orders} orders received</small></div>
        <div><dt>To process</dt><dd id="kpi-process">{data.toProcess}</dd><small>paid, not yet shipped</small></div>
        <div><dt>Awaiting payment</dt><dd>{data.awaitingPayment}</dd><small>{data.shipped} in transit</small></div>
      </dl>

      <div className="admin__grid">
        <section className="admin__card admin__card--wide" aria-labelledby="chart-title">
          <h2 id="chart-title">Paid revenue, last 7 days</h2>
          <RevenueChart daily={data.daily} />
        </section>

        <section className="admin__card" aria-labelledby="latest-title">
          <div className="admin__card-head"><h2 id="latest-title">Latest orders</h2><button type="button" className="admin__link" onClick={onOpenOrders}>View all</button></div>
          {data.latestOrders.length === 0 ? <p className="admin__muted">No orders yet.</p> : (
            <ul className="admin__list">
              {data.latestOrders.map((o) => (
                <li key={o.id}><span><strong>{o.number}</strong><small>{when(o.createdAt)}</small></span><span className="admin__list-end">{idr(o.totalIdr)}<span className={`admin__pill admin__pill--${o.status}`}>{STATUS[o.status]}</span></span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin__card" aria-labelledby="stock-title">
          <div className="admin__card-head"><h2 id="stock-title">Low stock</h2><button type="button" className="admin__link" onClick={onOpenProducts}>Manage stock</button></div>
          {data.lowStock.length === 0 ? <p className="admin__muted">Every variant has more than 2 in stock.</p> : (
            <>
              <ul className="admin__list">
                {data.lowStock.map((v) => (
                  <li key={v.sku}><span><strong>{v.product}</strong><small>{v.variant} · {v.sku}</small></span><span className={`admin__pill ${v.available === 0 ? 'admin__pill--cancelled' : 'admin__pill--unpaid'}`}>{v.available === 0 ? 'Sold out' : `${v.available} left`}</span></li>
                ))}
              </ul>
              {data.lowStockTotal > data.lowStock.length && <p className="admin__muted">+{data.lowStockTotal - data.lowStock.length} more variants with stock ≤ 2.</p>}
            </>
          )}
        </section>

        <section className="admin__card" aria-labelledby="top-title">
          <h2 id="top-title">Best sellers (paid orders)</h2>
          {data.topProducts.length === 0 ? <p className="admin__muted">No sales yet.</p> : (
            <ul className="admin__list">
              {data.topProducts.map((p, i) => <li key={i}><span><strong>{p.product}</strong><small>{p.variant}</small></span><span>{p.qty} sold</span></li>)}
            </ul>
          )}
          <p className="admin__muted">{data.customers} registered customers.</p>
        </section>
      </div>
    </>
  );
}

/**
 * Single-series bar chart (one measure, one hue): bars anchored to the baseline with rounded
 * tops, recessive gridlines, a hover/focus tooltip per day, the peak labelled directly, and
 * the same numbers as a table for anyone who prefers it.
 */
function RevenueChart({ daily }: { daily: OverviewData['daily'] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...daily.map((d) => d.paidIdr), 1);
  const peak = daily.findIndex((d) => d.paidIdr === max && d.paidIdr > 0);
  const W = 1100, H = 260, left = 8, bottom = 28, top = 60;
  const slot = (W - left) / daily.length;
  const bar = Math.min(56, slot - 16);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);

  return (
    <figure className="admin__chart">
      <div className="admin__chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Paid revenue per day, last 7 days. Peak ${idr(max === 1 ? 0 : max)}.`}>
          {[0.5, 1].map((f) => <line key={f} x1={left} x2={W} y1={y(max * f)} y2={y(max * f)} className="admin__chart-grid" />)}
          <line x1={left} x2={W} y1={H - bottom} y2={H - bottom} className="admin__chart-axis" />
          {daily.map((d, i) => {
            const x = left + slot * i + (slot - bar) / 2;
            const h = Math.max(d.paidIdr > 0 ? 3 : 0, H - bottom - y(d.paidIdr));
            return (
              <g key={d.date}>
                {/* Rounded top, square base on the axis. */}
                {h > 0 && <path className={`admin__chart-bar${active === i ? ' is-active' : ''}`} d={`M${x},${H - bottom} v${-(h - Math.min(4, h))} q0,${-Math.min(4, h)} ${Math.min(4, h)},${-Math.min(4, h)} h${bar - 2 * Math.min(4, h)} q${Math.min(4, h)},0 ${Math.min(4, h)},${Math.min(4, h)} v${h - Math.min(4, h)} z`} />}
                {i === peak && active !== i && <text x={x + bar / 2} y={y(d.paidIdr) - 8} textAnchor="middle" className="admin__chart-value">{short(d.paidIdr)}</text>}
                <text x={x + bar / 2} y={H - 8} textAnchor="middle" className="admin__chart-label">{dayLabel(d.date)}</text>
                {/* Hit target: the whole column, larger than the bar. */}
                <rect x={left + slot * i} y={0} width={slot} height={H - bottom} fill="transparent" tabIndex={0} aria-label={`${dayLabel(d.date)}: ${idr(d.paidIdr)}, ${d.orders} orders`}
                  onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <div className="admin__chart-tip" style={{ left: `${((left + slot * active + slot / 2) / W) * 100}%` }} role="status">
            <strong>{idr(daily[active].paidIdr)}</strong>
            <span>{dayLabel(daily[active].date)} · {daily[active].orders} orders</span>
          </div>
        )}
      </div>
      <details className="admin__chart-table">
        <summary>View as table</summary>
        <table>
          <thead><tr><th>Day</th><th>Orders received</th><th>Paid revenue</th></tr></thead>
          <tbody>{daily.map((d) => <tr key={d.date}><td>{dayLabel(d.date)}</td><td>{d.orders}</td><td>{idr(d.paidIdr)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
