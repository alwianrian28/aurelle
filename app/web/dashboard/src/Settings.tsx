import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, Pill } from './ui';
import { digits, grouped, saveError } from './lib';
import type { StoreSettings, User } from './types';

type Notice = { tone: 'ok' | 'error'; text: string } | null;
type Service = StoreSettings['shippingServices'][number];
const Note = ({ notice }: { notice: Notice }) => (notice ? <p className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null);

/**
 * The signed-in admin's own account, and the rules checkout applies: how long unpaid orders
 * keep their stock, the exchange rate, where the store ships, and what shipping costs. Changes
 * apply to what happens next; orders already placed keep what they were placed with.
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
        {data && (
          <>
            <Rules data={data} onSaved={setData} />
            <section className="card">
              <h2>Shipping services</h2>
              <p className="muted">What customers can choose at checkout. Orders already placed keep the service and price they chose.</p>
              {data.shippingServices.map((s) => <Shipping key={s.id} service={s} onSaved={setData} />)}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function Account({ user, onUser }: { user: User; onUser: (user: User) => void }) {
  const [name, setName] = useState(user.username);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const ok = name.trim().length >= 3;
  const dirty = name.trim() !== user.username;

  const save = async () => {
    if (!ok || !dirty || busy) return;
    setBusy(true);
    const res = await api<{ user: User }>('/admin/auth/profile', { method: 'PATCH', body: { username: name } });
    setBusy(false);
    if (res.ok) { onUser(res.data.user); setName(res.data.user.username); }
    setNotice(res.ok ? { tone: 'ok', text: 'Name saved.' } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2>Your account</h2>
      <Note notice={notice} />
      <div className="form-grid">
        <label className="field">Name
          <input id="settings-name" value={name} onChange={(e) => { setName(e.target.value); setNotice(null); }} maxLength={80} aria-invalid={!ok} autoComplete="name" />
          {!ok && <small className="field__error">Use at least 3 characters.</small>}
        </label>
        <label className="field">Email
          <input id="settings-email" value={user.email} readOnly aria-describedby="settings-email-note" />
          <small className="field__note" id="settings-email-note">You sign in with this address. It cannot be changed here.</small>
        </label>
      </div>
      <div className="form-actions"><Pill tone="grey">Admin</Pill><button type="submit" id="settings-name-save" className="btn btn--primary" disabled={!ok || !dirty || busy}>{busy ? 'Saving…' : 'Save name'}</button></div>
    </form>
  );
}

function Password() {
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

  const save = async () => {
    setTried(true);
    if (!current || !lengthOk || !matches || busy) return;
    setBusy(true);
    const res = await api('/admin/auth/password', { body: { current, password: next } });
    setBusy(false);
    if (res.ok) { setCurrent(''); setNext(''); setAgain(''); setTried(false); }
    setNotice(res.ok ? { tone: 'ok', text: 'Password changed. Other devices signed in to this account have been signed out.' } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2>Password</h2>
      <Note notice={notice} />
      <div className="form-grid form-grid--3">
        <label className="field">Current password
          <input id="settings-password-current" type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setNotice(null); }} autoComplete="current-password" aria-invalid={tried && !current} />
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
      <div className="form-actions"><button type="submit" id="settings-password-save" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
    </form>
  );
}

function Rules({ data, onSaved }: { data: StoreSettings; onSaved: (next: StoreSettings) => void }) {
  const [minutes, setMinutes] = useState(String(data.reservationMinutes));
  const [rate, setRate] = useState(String(data.usdToIdr));
  const [countries, setCountries] = useState(data.servedCountries);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const minutesOk = minutes !== '' && Number(minutes) >= 5 && Number(minutes) <= 1440;
  const rateOk = rate !== '' && Number(rate) >= 1000 && Number(rate) <= 100_000;
  const dirty = Number(minutes) !== data.reservationMinutes || Number(rate) !== data.usdToIdr || countries.join('|') !== data.servedCountries.join('|');
  const name = adding.trim();
  const canAdd = name.length >= 2 && !/[<>"]/.test(name) && !countries.some((c) => c.toLowerCase() === name.toLowerCase());
  const add = () => { if (canAdd) { setCountries([...countries, name]); setAdding(''); setNotice(null); } };

  const save = async () => {
    if (!minutesOk || !rateOk || countries.length === 0 || !dirty || busy) return;
    setBusy(true);
    const res = await api<StoreSettings>('/admin/settings', { method: 'PATCH', body: { reservationMinutes: Number(minutes), usdToIdr: Number(rate), servedCountries: countries } });
    setBusy(false);
    if (res.ok) { onSaved(res.data); setCountries(res.data.servedCountries); }
    setNotice(res.ok ? { tone: 'ok', text: 'Checkout rules saved. They apply to orders placed from now on.' } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2>Checkout rules</h2>
      <Note notice={notice} />
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
        {dirty && <button type="button" className="btn" onClick={() => { setMinutes(String(data.reservationMinutes)); setRate(String(data.usdToIdr)); setCountries(data.servedCountries); setNotice(null); }}>Discard</button>}
        <button type="submit" id="settings-rules-save" className="btn btn--primary" disabled={!minutesOk || !rateOk || !dirty || busy}>{busy ? 'Saving…' : 'Save rules'}</button>
      </div>
    </form>
  );
}

function Shipping({ service, onSaved }: { service: Service; onSaved: (next: StoreSettings) => void }) {
  const [nameEn, setNameEn] = useState(service.name.en);
  const [nameId, setNameId] = useState(service.name.id);
  const [courier, setCourier] = useState(service.courier);
  const [eta, setEta] = useState(service.etaDays);
  const [cost, setCost] = useState(String(service.costIdr));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setNotice(null); };

  // Hyphen or en dash: the services the store started with are written "7–12".
  const range = /^(\d{1,2})(?:[-–](\d{1,2}))?$/.exec(eta.trim());
  const etaOk = !!range && (range[2] === undefined || Number(range[1]) <= Number(range[2]));
  const ok = nameEn.trim().length >= 2 && nameId.trim().length >= 2 && courier.trim().length >= 2 && etaOk && cost !== '';
  const dirty = nameEn.trim() !== service.name.en || nameId.trim() !== service.name.id || courier.trim() !== service.courier || eta.trim() !== service.etaDays || Number(cost) !== service.costIdr;

  const save = async () => {
    if (!ok || !dirty || busy) return;
    setBusy(true);
    const res = await api<StoreSettings>(`/admin/shipping/${service.id}`, { method: 'PATCH', body: { nameEn, nameId, courier, etaDays: eta.trim(), costIdr: Number(cost) } });
    setBusy(false);
    if (res.ok) onSaved(res.data);
    setNotice(res.ok ? { tone: 'ok', text: `${nameEn.trim()} saved.` } : { tone: 'error', text: saveError(res.error) });
  };

  return (
    <form className="service" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate aria-label={service.name.en}>
      <Note notice={notice} />
      <div className="form-grid">
        <label className="field">Name (English)<input id={`ship-name-en-${service.id}`} value={nameEn} onChange={(e) => change(setNameEn)(e.target.value)} maxLength={80} aria-invalid={nameEn.trim().length < 2} /></label>
        <label className="field">Name (Indonesian)<input id={`ship-name-id-${service.id}`} value={nameId} onChange={(e) => change(setNameId)(e.target.value)} maxLength={80} aria-invalid={nameId.trim().length < 2} /></label>
      </div>
      <div className="form-grid form-grid--3">
        <label className="field">Courier<input id={`ship-courier-${service.id}`} value={courier} onChange={(e) => change(setCourier)(e.target.value)} maxLength={60} aria-invalid={courier.trim().length < 2} /></label>
        <label className="field">Estimated delivery
          <span className={`money${etaOk ? '' : ' is-invalid'}`}><input id={`ship-eta-${service.id}`} value={eta} onChange={(e) => change(setEta)(e.target.value)} maxLength={5} aria-invalid={!etaOk} /><span>days</span></span>
          {!etaOk && <small className="field__error">A number or a range, like 5 or 7-12.</small>}
        </label>
        <label className="field">Cost
          <span className={`money${cost === '' ? ' is-invalid' : ''}`}><span>Rp</span><input id={`ship-cost-${service.id}`} inputMode="numeric" value={grouped(cost)} onChange={(e) => change(setCost)(digits(e.target.value).slice(0, 9))} aria-invalid={cost === ''} /></span>
        </label>
      </div>
      <div className="form-actions"><button type="submit" id={`ship-save-${service.id}`} className="btn btn--primary" disabled={!ok || !dirty || busy}>{busy ? 'Saving…' : 'Save service'}</button></div>
    </form>
  );
}
