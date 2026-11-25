import { useEffect, useState } from 'react';
import { api } from './api';
import { Pill } from './ui';
import { idr } from './lib';
import type { StoreSettings, User } from './types';

/** Who is signed in and the store rules the API applies at checkout. Read-only. */
export default function Settings({ user }: { user: User }) {
  const [data, setData] = useState<StoreSettings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void api<StoreSettings>('/admin/settings').then((res) => { if (live) { if (res.ok) setData(res.data); else setFailed(true); } });
    return () => { live = false; };
  }, []);

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Your account and the rules the store runs on</p></div></div>
      <div className="settings">
        <section className="card">
          <h2>Your account</h2>
          <dl className="summary">
            <div><dt>Name</dt><dd>{user.username}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Role</dt><dd><Pill tone="grey">Admin</Pill></dd></div>
          </dl>
        </section>

        {failed && <p className="empty" role="alert">Could not load the store settings.</p>}
        {data && (
          <>
            <section className="card">
              <h2>Checkout rules</h2>
              <dl className="summary">
                <div><dt>Stock reservation for unpaid orders</dt><dd>{data.reservationMinutes} minutes</dd></div>
                <div><dt>Exchange rate</dt><dd>1 USD = {idr(data.usdToIdr)}</dd></div>
                <div><dt>Ships to</dt><dd>{data.servedCountries.join(', ')}</dd></div>
              </dl>
              <p className="muted">These values are set on the server and cannot be changed from the dashboard yet.</p>
            </section>

            <section className="card card--flush">
              <div className="card__head"><h2>Shipping services</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Service</th><th>Courier</th><th>Estimated delivery</th><th className="num">Cost</th></tr></thead>
                  <tbody>{data.shippingServices.map((s) => <tr key={s.id}><td><strong>{s.name.en}</strong></td><td>{s.courier}</td><td className="soft">{s.etaDays} days</td><td className="num">{idr(s.costIdr)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
