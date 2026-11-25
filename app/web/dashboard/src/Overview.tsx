import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { ExportMenu, FulfillmentPill, Icon, PaymentPill, Select, Thumb } from './ui';
import { idr, idrShort, plural, todayLong } from './lib';
import type { Report } from './export';
import type { IconName } from './ui';
import type { Go, OverviewData, Route } from './types';

type Days = '7' | '30' | '90';
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', weekday: 'short' });
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Dashboard home: the period's numbers, paid revenue per day, and what needs attention. Refreshes every 30 s. */
export default function Overview({ go }: { go: Go }) {
  const [days, setDays] = useState<Days>('7');
  const [data, setData] = useState<OverviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [asTable, setAsTable] = useState(false);

  const load = useCallback(async () => {
    const res = await api<OverviewData>(`/admin/overview?days=${days}`);
    setFailed(!res.ok);
    if (res.ok) setData(res.data);
  }, [days]);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [load]);

  if (!data) return <p className="empty" role={failed ? 'alert' : undefined}>{failed ? 'Could not load the overview. Make sure the backend is running.' : 'Loading…'}</p>;

  const n = data.period.days;
  const soldOut = data.lowStock.filter((v) => v.available === 0);
  const low = data.lowStockTotal - data.soldOutTotal;
  const names = (items: OverviewData['lowStock'], total: number) => {
    const shown = items.slice(0, 3).map((v) => `${v.product} ${v.variant}`).join(', ');
    return total > 3 ? `${shown} and ${total - 3} more.` : `${shown}.`;
  };
  const attention: { icon: IconName; tone: string; title: string; text: string; action: string; to: Route }[] = [
    ...(data.toProcess > 0 ? [{ icon: 'truck' as const, tone: 'amber', title: `${plural(data.toProcess, 'order')} to ship`, text: 'Paid and waiting to be packed.', action: 'Go to orders', to: { view: 'orders' as const, tab: 'toship' } }] : []),
    ...(data.awaitingPayment > 0 ? [{ icon: 'receipt' as const, tone: 'grey', title: `${plural(data.awaitingPayment, 'order')} awaiting payment`, text: 'Stock is held until the reservation window ends.', action: data.awaitingPayment === 1 ? 'View order' : 'View orders', to: { view: 'orders' as const, tab: 'awaiting' } }] : []),
    ...(data.soldOutTotal > 0 ? [{ icon: 'box' as const, tone: 'red', title: `${plural(data.soldOutTotal, 'variant')} sold out`, text: names(soldOut, data.soldOutTotal), action: 'Restock', to: { view: 'products' as const, tab: 'restock' } }] : []),
    ...(low > 0 ? [{ icon: 'box' as const, tone: 'amber', title: `${plural(low, 'variant')} low on stock`, text: '2 or fewer left to sell.', action: 'Review stock', to: { view: 'products' as const } }] : []),
  ];

  const report = (): Report => ({
    file: `aurelle-revenue-${n}d`,
    title: 'Paid revenue by day',
    subtitle: `Last ${n} days: ${plural(data.period.orders, 'order')} received, ${plural(data.period.paidOrders, 'paid order')}`,
    columns: [{ header: 'Date', kind: 'date', width: 16 }, { header: 'Orders received', kind: 'int', width: 17 }, { header: 'Paid revenue', kind: 'money', width: 20 }],
    rows: data.daily.map((d) => [d.date, d.orders, d.paidIdr]),
    totals: ['Total', data.period.orders, data.period.paidIdr],
  });

  return (
    <>
      <div className="page-head">
        <div><h1>Overview</h1><p>{todayLong()}</p></div>
        <div className="page-head__actions">
          <Select id="overview-period" label="Period" value={days} onChange={setDays} options={[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']]} />
          <ExportMenu id="overview-export" report={report} />
        </div>
      </div>

      <dl className="tiles">
        <div><dt>Paid revenue</dt><dd id="kpi-revenue" title={idr(data.period.paidIdr)}>{idrShort(data.period.paidIdr)}</dd><small>{plural(data.period.paidOrders, 'paid order')}</small></div>
        <div><dt>Orders</dt><dd id="kpi-orders">{data.period.orders}</dd><small>Last {n} days</small></div>
        <div><dt>To ship</dt><dd id="kpi-process">{data.toProcess}</dd><small>Paid, not shipped</small></div>
        <div><dt>Awaiting payment</dt><dd id="kpi-awaiting">{data.awaitingPayment}</dd><small>{data.awaitingPayment > 0 ? `${idrShort(data.awaitingPaymentIdr)} held` : 'Nothing on hold'}</small></div>
      </dl>

      <div className="grid">
        <section className="card" aria-labelledby="chart-title">
          <div className="card__head"><h2 id="chart-title">Paid revenue, last {n} days</h2><button type="button" className="link" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? 'View as chart' : 'View as table'}</button></div>
          {asTable ? (
            <div className="table-wrap table-wrap--short">
              <table className="table">
                <thead><tr><th>Day</th><th className="num">Orders received</th><th className="num">Paid revenue</th></tr></thead>
                <tbody>{data.daily.map((d) => <tr key={d.date}><td>{longDate(d.date)}</td><td className="num">{d.orders}</td><td className="num">{idr(d.paidIdr)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <RevenueChart daily={data.daily} />}
        </section>

        <section className="card" aria-labelledby="attention-title">
          <div className="card__head"><h2 id="attention-title">Needs attention</h2></div>
          {attention.length === 0 ? <p className="muted">Nothing needs you right now.</p> : (
            <ul className="attention">
              {attention.map((a) => (
                <li key={a.title}>
                  <span className={`chip chip--lg chip--${a.tone}`}><Icon name={a.icon} size={18} /></span>
                  <span><strong>{a.title}</strong><small>{a.text}</small></span>
                  <button type="button" className="link" onClick={() => go(a.to)}>{a.action}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card--flush" aria-labelledby="latest-title">
          <div className="card__head"><h2 id="latest-title">Latest orders</h2><button type="button" className="link link--arrow" onClick={() => go({ view: 'orders' })}>View all<Icon name="arrowRight" size={14} /></button></div>
          {data.latestOrders.length === 0 ? <p className="muted">No orders yet.</p> : (
            <div className="table-wrap">
              <table className="table table--cards t-latest">
                <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfillment</th></tr></thead>
                <tbody>
                  {data.latestOrders.map((o) => (
                    <tr key={o.id}>
                      <td><button type="button" className="table__key" onClick={() => go({ view: 'orders', id: o.id })}>{o.number}</button></td>
                      <td className="soft nowrap">{o.customer ?? '—'}</td>
                      <td className="nowrap">{idr(o.totalIdr)}</td>
                      <td><PaymentPill status={o.paymentStatus} /></td>
                      <td><FulfillmentPill status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="top-title">
          <div className="card__head"><h2 id="top-title">Best sellers</h2></div>
          {data.topProducts.length === 0 ? <p className="muted">No paid orders yet.</p> : (
            <ul className="sellers">
              {data.topProducts.map((p) => (
                <li key={p.productId}><Thumb src={p.thumb} size={40} /><button type="button" className="sellers__name" onClick={() => go({ view: 'products', id: p.productId })}>{p.product}</button><span className="soft">{p.qty} sold</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * Single-series bar chart (one measure, one hue): bars anchored to the baseline with rounded
 * tops and a hover/focus tooltip per day. A week labels every bar; longer periods label only
 * the peak, so the numbers never collide.
 */
function RevenueChart({ daily }: { daily: OverviewData['daily'] }) {
  const [active, setActive] = useState<number | null>(null);
  // Drawn at the width it is shown at, so labels keep their real size on a phone.
  const [W, setW] = useState(660);
  const figure = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = figure.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(...daily.map((d) => d.paidIdr), 1);
  const peak = daily.findIndex((d) => d.paidIdr === max && d.paidIdr > 0);
  const H = W < 480 ? 220 : 290, bottom = 30, top = 34;
  const slot = W / daily.length;
  const bar = Math.max(3, Math.min(56, slot * 0.6));
  const r = Math.min(5, bar / 2);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  // A label needs about 62 px (value) or 44 px (day): thin them out when the columns are narrower.
  const every = Math.max(1, Math.ceil(44 / slot));
  const week = slot >= 62;

  return (
    <figure className="chart" ref={figure}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Paid revenue per day, last ${daily.length} days. Highest day ${idr(peak < 0 ? 0 : max)}.`}>
        <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} className="chart__axis" />
        {daily.map((d, i) => {
          const x = slot * i + (slot - bar) / 2;
          const h = d.paidIdr > 0 ? Math.max(r + 1, H - bottom - y(d.paidIdr)) : 0;
          return (
            <g key={d.date}>
              {h > 0
                ? <path className={`chart__bar${active === i ? ' is-active' : ''}`} d={`M${x},${H - bottom} v${-(h - r)} q0,${-r} ${r},${-r} h${bar - 2 * r} q${r},0 ${r},${r} v${h - r} z`} />
                : <rect className="chart__zero" x={x} y={H - bottom - 2} width={bar} height={2} />}
              {(week || i === peak) && <text x={x + bar / 2} y={(h > 0 ? H - bottom - h : H - bottom) - 10} textAnchor="middle" className="chart__value">{d.paidIdr > 0 ? idrShort(d.paidIdr) : '–'}</text>}
              {(daily.length - 1 - i) % every === 0 && <text x={x + bar / 2} y={H - 8} textAnchor="middle" className="chart__label">{dayLabel(d.date)}</text>}
              {/* Hit target: the whole column, larger than the bar. */}
              <rect x={slot * i} y={0} width={slot} height={H - bottom} fill="transparent" tabIndex={0} aria-label={`${longDate(d.date)}: ${idr(d.paidIdr)}, ${plural(d.orders, 'order')}`}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
            </g>
          );
        })}
      </svg>
      {active !== null && (
        <div className="chart__tip" style={{ left: `${Math.min(88, Math.max(12, ((slot * active + slot / 2) / W) * 100))}%` }} role="status">
          <strong>{idr(daily[active].paidIdr)}</strong>
          <span>{longDate(daily[active].date)} · {plural(daily[active].orders, 'order')}</span>
        </div>
      )}
    </figure>
  );
}
