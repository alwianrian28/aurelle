import { useState } from 'react';
import { Icon, Pager, Pill } from './ui';
import { PAGE, dateOnly, downloadCsv, idr, plural } from './lib';
import type { Customer, Go } from './types';

/** Customer accounts with what each has ordered and paid. A name opens that customer's orders. */
export default function Customers({ customers, go }: { customers: Customer[]; go: Go }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const q = query.trim().toLowerCase();
  const shown = customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  const buyers = customers.filter((c) => c.paidIdr > 0).length;

  const exportCsv = () => downloadCsv('aurelle-customers', [
    ['Name', 'Email', 'Phone', 'Email verified', 'Joined', 'Orders', 'Paid total (IDR)', 'Last order'],
    ...shown.map((c) => [c.name, c.email, c.phone ?? '', c.emailVerified ? 'yes' : 'no', c.createdAt, c.orders, c.paidIdr, c.lastOrderAt ?? '']),
  ]);

  return (
    <>
      <div className="page-head">
        <div><h1>Customers</h1><p>{plural(customers.length, 'customer')} · {buyers} with a paid order</p></div>
        <div className="page-head__actions"><button type="button" id="customers-export" className="btn" disabled={shown.length === 0} onClick={exportCsv}><Icon name="download" />Export</button></div>
      </div>

      <section className="card card--flush">
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input id="customers-search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search by name or email" aria-label="Search customers" /></label>
        </div>
        <div className="table-wrap">
          <table className="table table--cards t-customers">
            <thead><tr><th>Customer</th><th>Joined</th><th className="num">Orders</th><th className="num">Paid total</th><th>Last order</th><th>Email</th></tr></thead>
            <tbody>
              {shown.slice(page * PAGE, (page + 1) * PAGE).map((c) => (
                <tr key={c.id}>
                  <td>{c.orders > 0 ? <button type="button" className="table__key" onClick={() => go({ view: 'orders', q: c.email })}>{c.name}</button> : <strong>{c.name}</strong>}<small>{c.email}{c.phone ? ` · ${c.phone}` : ''}</small></td>
                  <td className="soft nowrap">{dateOnly(c.createdAt)}</td>
                  <td className="num">{c.orders}</td>
                  <td className="num nowrap">{idr(c.paidIdr)}</td>
                  <td className="soft nowrap">{c.lastOrderAt ? dateOnly(c.lastOrderAt) : '—'}</td>
                  <td><Pill tone={c.emailVerified ? 'green' : 'grey'}>{c.emailVerified ? 'Verified' : 'Not verified'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="empty">{customers.length === 0 ? 'No customers have registered yet.' : 'No customers match this search.'}</p>}
        </div>
        <Pager page={page} total={shown.length} onPage={setPage} />
      </section>
    </>
  );
}
