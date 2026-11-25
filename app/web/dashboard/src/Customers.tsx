import { useState } from 'react';
import { ExportMenu, Icon, Pager, Pill } from './ui';
import { PAGE, dateOnly, idr, plural } from './lib';
import type { Report } from './export';
import type { Customer, Go } from './types';

/** Customer accounts with what each has ordered and paid. A name opens that customer's orders. */
export default function Customers({ customers, go }: { customers: Customer[]; go: Go }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE);
  const q = query.trim().toLowerCase();
  const shown = customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  const buyers = customers.filter((c) => c.paidIdr > 0).length;

  const report = (): Report => ({
    file: 'aurelle-customers',
    title: 'Customers',
    subtitle: `${plural(shown.length, 'customer')}${q ? ` matching "${query.trim()}"` : ''}`,
    columns: [
      { header: 'Name', width: 24 }, { header: 'Email', width: 32, flex: true }, { header: 'Phone', width: 18 }, { header: 'Email verified', width: 15, wide: true },
      { header: 'Joined', kind: 'date', width: 14 }, { header: 'Orders', kind: 'int', width: 9 }, { header: 'Paid total', kind: 'money', width: 17 }, { header: 'Last order', kind: 'date', width: 14 },
    ],
    rows: shown.map((c) => [c.name, c.email, c.phone ?? '', c.emailVerified ? 'Yes' : 'No', c.createdAt, c.orders, c.paidIdr, c.lastOrderAt ?? '']),
    totals: ['Total', plural(shown.length, 'customer'), null, null, null, shown.reduce((n, c) => n + c.orders, 0), shown.reduce((n, c) => n + c.paidIdr, 0), null],
  });

  return (
    <>
      <div className="page-head">
        <div><h1>Customers</h1><p>{plural(customers.length, 'customer')} · {buyers} with a paid order</p></div>
        <div className="page-head__actions"><ExportMenu id="customers-export" report={report} disabled={shown.length === 0} /></div>
      </div>

      <section className="card card--flush">
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input id="customers-search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search by name or email" aria-label="Search customers" /></label>
        </div>
        <div className="table-wrap">
          <table className="table table--cards t-customers">
            <thead><tr><th>Customer</th><th>Joined</th><th className="num">Orders</th><th className="num">Paid total</th><th>Last order</th><th>Email</th></tr></thead>
            <tbody>
              {shown.slice(page * size, (page + 1) * size).map((c) => (
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
        <Pager id="customers" page={page} total={shown.length} size={size} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} />
      </section>
    </>
  );
}
