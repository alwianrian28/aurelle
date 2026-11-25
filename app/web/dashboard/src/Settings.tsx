import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, Pill } from './ui';
import { digits, grouped, idr, saveError } from './lib';
import type { StoreSettings, User } from './types';

type Notice = { tone: 'ok' | 'error'; text: string } | null;
type Service = StoreSettings['shippingServices'][number];
const Note = ({ notice }: { notice: Notice }) => (notice ? <p className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null);

/**
 * The signed-in admin's own account, and the rules checkout applies: how long unpaid orders
 * keep their stock, the exchange rate, where the store ships, and the shipping services on
 * offer. Every section shows its values first; Edit (or Add) opens the form for that section
 * only. Changes apply to what happens next: orders already placed keep what they were placed with.
 */
export default function Settings({ user, onUser }: { user: User; onUser: (user: User) => void }) {
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
        <Account user={user} onUser={onUser} />
        <Password />
        {failed && <p className="empty" role="alert">Could not load the store settings.</p>}
        {data && <><Rules data={data} onSaved={setData} /><ShippingServices services={data.shippingServices} onSaved={setData} /></>}
      </div>
    </>
  );
}

function Account({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.username);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const ok = name.trim().length >= 3;

  const save = async () => {
    if (!ok || busy) return;
    if (name.trim() === user.username) { setEditing(false); return; }
    setBusy(true);
    const res = await api<{ user: User }>('/admin/auth/profile', { method: 'PATCH', body: { username: name } });
    setBusy(false);
    if (res.ok) { onUser(res.data.user); setEditing(false); }
    setNotice(res.ok ? { tone: 'ok', text: 'Name saved.' } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <section className="card">
      <div className="card__head"><h2>Your account</h2>{!editing && <button type="button" id="settings-account-edit" className="btn btn--small" onClick={() => { setName(user.username); setNotice(null); setEditing(true); }}><Icon name="edit" />Edit</button>}</div>
      <Note notice={notice} />
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <div className="form-grid">
            <label className="field">Name
              <input id="settings-name" value={name} onChange={(e) => { setName(e.target.value); setNotice(null); }} maxLength={80} aria-invalid={!ok} autoComplete="name" autoFocus />
              {!ok && <small className="field__error">Use at least 3 characters.</small>}
            </label>
            <label className="field">Email
              <input id="settings-email" value={user.email} readOnly aria-describedby="settings-email-note" />
              <small className="field__note" id="settings-email-note">You sign in with this address. It cannot be changed here.</small>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => { setEditing(false); setNotice(null); }}>Cancel</button>
            <button type="submit" id="settings-name-save" className="btn btn--primary" disabled={!ok || busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <dl className="summary">
          <div><dt>Name</dt><dd id="settings-name-value">{user.username}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Role</dt><dd><Pill tone="grey">Admin</Pill></dd></div>
        </dl>
      )}
    </section>
  );
}

function Password() {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // The API counts bytes (bcrypt reads at most 72), not characters.
  const bytes = new TextEncoder().encode(next).length;
  const lengthOk = next.length >= 12 && bytes <= 72;
  const matches = next === again;
  const close = () => { setCurrent(''); setNext(''); setAgain(''); setTried(false); setEditing(false); };

  const save = async () => {
    setTried(true);
    if (!current || !lengthOk || !matches || busy) return;
    setBusy(true);
    const res = await api('/admin/auth/password', { body: { current, password: next } });
    setBusy(false);
    if (res.ok) close();
    setNotice(res.ok ? { tone: 'ok', text: 'Password changed. Other devices signed in to this account have been signed out.' } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <section className="card">
      <div className="card__head"><h2>Password</h2>{!editing && <button type="button" id="settings-password-edit" className="btn btn--small" onClick={() => { setNotice(null); setEditing(true); }}><Icon name="edit" />Change</button>}</div>
      <Note notice={notice} />
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <div className="form-grid form-grid--3">
            <label className="field">Current password
              <input id="settings-password-current" type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setNotice(null); }} autoComplete="current-password" aria-invalid={tried && !current} autoFocus />
            </label>
            <label className="field">New password
              <input id="settings-password-new" type="password" value={next} onChange={(e) => { setNext(e.target.value); setNotice(null); }} autoComplete="new-password" aria-invalid={tried && !lengthOk} />
              <small className={tried && !lengthOk ? 'field__error' : 'field__note'}>{bytes > 72 ? 'Too long: use at most 72 characters.' : 'At least 12 characters.'}</small>
            </label>
            <label className="field">Repeat new password
              <input id="settings-password-again" type="password" value={again} onChange={(e) => { setAgain(e.target.value); setNotice(null); }} autoComplete="new-password" aria-invalid={tried && !matches} />
              {tried && !matches && <small className="field__error">The two passwords are different.</small>}
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => { close(); setNotice(null); }}>Cancel</button>
            <button type="submit" id="settings-password-save" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
          </div>
        </form>
      ) : <p className="muted">Used to sign in to this dashboard. Changing it signs out every other device.</p>}
    </section>
  );
}

function Rules({ data, onSaved }: { data: StoreSettings; onSaved: (next: StoreSettings) => void }) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [rate, setRate] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const open = () => { setMinutes(String(data.reservationMinutes)); setRate(String(data.usdToIdr)); setCountries(data.servedCountries); setAdding(''); setNotice(null); setEditing(true); };

  const minutesOk = minutes !== '' && Number(minutes) >= 5 && Number(minutes) <= 1440;
  const rateOk = rate !== '' && Number(rate) >= 1000 && Number(rate) <= 100_000;
  const name = adding.trim();
  const canAdd = name.length >= 2 && !/[<>"]/.test(name) && !countries.some((c) => c.toLowerCase() === name.toLowerCase());
  const add = () => { if (canAdd) { setCountries([...countries, name]); setAdding(''); setNotice(null); } };

  const save = async () => {
    if (!minutesOk || !rateOk || countries.length === 0 || busy) return;
    setBusy(true);
    // A country typed but not yet added is what the admin meant to add.
    const list = canAdd ? [...countries, name] : countries;
    const res = await api<StoreSettings>('/admin/settings', { method: 'PATCH', body: { reservationMinutes: Number(minutes), usdToIdr: Number(rate), servedCountries: list } });
    setBusy(false);
    if (res.ok) { onSaved(res.data); setEditing(false); }
    setNotice(res.ok ? { tone: 'ok', text: 'Checkout rules saved. They apply to orders placed from now on.' } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <section className="card">
      <div className="card__head"><h2>Checkout rules</h2>{!editing && <button type="button" id="settings-rules-edit" className="btn btn--small" onClick={open}><Icon name="edit" />Edit</button>}</div>
      <Note notice={notice} />
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <div className="form-grid">
            <label className="field">Stock reservation for unpaid orders
              <span className={`money${minutesOk ? '' : ' is-invalid'}`}><input id="settings-minutes" inputMode="numeric" value={minutes} onChange={(e) => { setMinutes(digits(e.target.value).slice(0, 4)); setNotice(null); }} aria-invalid={!minutesOk} /><span>minutes</span></span>
              <small className={minutesOk ? 'field__note' : 'field__error'}>5 to 1,440 minutes (24 hours). After this an unpaid order is cancelled and its stock goes back on sale.</small>
            </label>
            <label className="field">Exchange rate, 1 USD
              <span className={`money${rateOk ? '' : ' is-invalid'}`}><span>Rp</span><input id="settings-rate" inputMode="numeric" value={grouped(rate)} onChange={(e) => { setRate(digits(e.target.value).slice(0, 6)); setNotice(null); }} aria-invalid={!rateOk} /></span>
              <small className={rateOk ? 'field__note' : 'field__error'}>Rp 1.000 to Rp 100.000. Used to show prices in USD; an order locks the rate it was placed at.</small>
            </label>
          </div>
          <div className="field">
            <span id="settings-countries-label">Ships to</span>
            <ul className="chips" aria-labelledby="settings-countries-label">
              {countries.map((c) => (
                <li key={c}>{c}<button type="button" aria-label={`Stop shipping to ${c}`} disabled={countries.length === 1} onClick={() => { setCountries(countries.filter((x) => x !== c)); setNotice(null); }}><Icon name="x" size={13} /></button></li>
              ))}
            </ul>
            <div className="media__add">
              <label className="field">Add a country
                <input id="settings-country" value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={80} placeholder="e.g. Japan" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
              </label>
              <button type="button" id="settings-country-add" className="btn" disabled={!canAdd} onClick={add}><Icon name="plus" />Add</button>
            </div>
            <small className="field__note">Checkout refuses addresses in any other country. At least one country is needed.</small>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => { setEditing(false); setNotice(null); }}>Cancel</button>
            <button type="submit" id="settings-rules-save" className="btn btn--primary" disabled={!minutesOk || !rateOk || busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <dl className="summary">
          <div><dt>Stock reservation for unpaid orders</dt><dd>{data.reservationMinutes} minutes</dd></div>
          <div><dt>Exchange rate</dt><dd>1 USD = {idr(data.usdToIdr)}</dd></div>
          <div><dt>Ships to</dt><dd>{data.servedCountries.join(', ')}</dd></div>
        </dl>
      )}
    </section>
  );
}

/** The services checkout offers, as a list. One form at a time: for a new service, or for the one being edited. */
function ShippingServices({ services, onSaved }: { services: Service[]; onSaved: (next: StoreSettings) => void }) {
  // The id of the service being edited, 'new' while adding one, or nothing.
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const editing = services.find((s) => s.id === open);

  const remove = async (s: Service) => {
    if (busy || !window.confirm(`Delete the shipping service “${s.name.en}”? Customers can no longer choose it. Orders already placed keep it.`)) return;
    setBusy(true);
    const res = await api<StoreSettings>(`/admin/shipping/${s.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { onSaved(res.data); setOpen(null); }
    setNotice(res.ok ? { tone: 'ok', text: `${s.name.en} deleted.` } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <section className="card card--flush">
      <div className="card__head"><h2>Shipping services</h2>{open === null && <button type="button" id="shipping-add" className="btn btn--small" disabled={services.length >= 12} onClick={() => { setNotice(null); setOpen('new'); }}><Icon name="plus" />Add service</button>}</div>
      {notice && <div className="card__notice"><Note notice={notice} /></div>}
      <div className="table-wrap">
        <table className="table table--cards t-shipping">
          <thead><tr><th>Service</th><th>Courier</th><th>Estimated delivery</th><th className="num">Cost</th><th><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className={s.id === open ? 'is-selected' : ''}>
                <td><strong>{s.name.en}</strong><small>{s.name.id}</small></td>
                <td>{s.courier}</td>
                <td className="soft">{s.etaDays} {s.etaDays === '1' ? 'day' : 'days'}</td>
                <td className="num nowrap">{idr(s.costIdr)}</td>
                <td className="end">
                  <span className="row-actions">
                    <button type="button" id={`ship-edit-${s.id}`} className="link" onClick={() => { setNotice(null); setOpen(s.id); }}>Edit</button>
                    <button type="button" id={`ship-delete-${s.id}`} className="btn btn--icon btn--ghost" aria-label={`Delete ${s.name.en}`} disabled={busy || services.length === 1} title={services.length === 1 ? 'The store needs at least one shipping service' : undefined} onClick={() => void remove(s)}><Icon name="trash" /></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open !== null && (open === 'new' || editing) && (
        <ShippingForm key={open} service={editing} onClose={() => setOpen(null)} onSaved={(next, text) => { onSaved(next); setOpen(null); setNotice({ tone: 'ok', text }); }} />
      )}
    </section>
  );
}

function ShippingForm({ service, onClose, onSaved }: { service: Service | undefined; onClose: () => void; onSaved: (next: StoreSettings, text: string) => void }) {
  const [nameEn, setNameEn] = useState(service?.name.en ?? '');
  const [nameId, setNameId] = useState(service?.name.id ?? '');
  const [courier, setCourier] = useState(service?.courier ?? '');
  const [eta, setEta] = useState(service?.etaDays ?? '');
  const [cost, setCost] = useState(service ? String(service.costIdr) : '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Hyphen or en dash: the services the store started with are written "7–12".
  const range = /^(\d{1,2})(?:[-–](\d{1,2}))?$/.exec(eta.trim());
  const bad = {
    nameEn: nameEn.trim().length < 2,
    nameId: nameId.trim().length === 1,
    courier: courier.trim().length < 2,
    eta: !range || (range[2] !== undefined && Number(range[1]) > Number(range[2])),
    cost: cost === '',
  };
  const ok = !Object.values(bad).some(Boolean);

  const save = async () => {
    setTried(true);
    if (!ok || busy) return;
    setBusy(true);
    setError('');
    // Without an Indonesian name the English one is shown to everyone.
    const body = { nameEn, nameId: nameId.trim() || nameEn, courier, etaDays: eta.trim(), costIdr: Number(cost) };
    const res = service
      ? await api<StoreSettings>(`/admin/shipping/${service.id}`, { method: 'PATCH', body })
      : await api<StoreSettings>('/admin/shipping', { body });
    setBusy(false);
    if (res.ok) onSaved(res.data, `${nameEn.trim()} ${service ? 'saved' : 'added'}.`);
    else setError(saveError(res.error));
  };

  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate aria-label={service ? `Edit ${service.name.en}` : 'New shipping service'}>
      <h3>{service ? `Edit ${service.name.en}` : 'New shipping service'}</h3>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <div className="form-grid">
        <label className="field">Name (English)<input id="ship-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={80} placeholder="e.g. Same Day" aria-invalid={tried && bad.nameEn} autoFocus /></label>
        <label className="field">Name (Indonesian)<input id="ship-name-id" value={nameId} onChange={(e) => setNameId(e.target.value)} maxLength={80} placeholder="Optional" aria-invalid={tried && bad.nameId} /></label>
      </div>
      <div className="form-grid form-grid--3">
        <label className="field">Courier<input id="ship-courier" value={courier} onChange={(e) => setCourier(e.target.value)} maxLength={60} placeholder="e.g. JNE" aria-invalid={tried && bad.courier} /></label>
        <label className="field">Estimated delivery
          <span className={`money${tried && bad.eta ? ' is-invalid' : ''}`}><input id="ship-eta" value={eta} onChange={(e) => setEta(e.target.value)} maxLength={5} placeholder="e.g. 3-5" aria-invalid={tried && bad.eta} /><span>days</span></span>
          {tried && bad.eta && <small className="field__error">A number or a range, like 5 or 7-12.</small>}
        </label>
        <label className="field">Cost
          <span className={`money${tried && bad.cost ? ' is-invalid' : ''}`}><span>Rp</span><input id="ship-cost" inputMode="numeric" value={grouped(cost)} onChange={(e) => setCost(digits(e.target.value).slice(0, 9))} aria-invalid={tried && bad.cost} /></span>
        </label>
      </div>
      {tried && !ok && <small className="field__error">Fill in the highlighted fields.</small>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" id="ship-save" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : service ? 'Save' : 'Add service'}</button>
      </div>
    </form>
  );
}
