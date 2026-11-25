import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import Overview from './Overview';
import Orders from './Orders';
import Products from './Products';
import ProductEdit from './ProductEdit';
import ProductNew from './ProductNew';
import Collections from './Collections';
import Customers from './Customers';
import Settings from './Settings';
import { Icon, MenuItem, Pill, Popover, Thumb } from './ui';
import { ago, idr, shopUrl, stageOf } from './lib';
import type { IconName } from './ui';
import type { AdminOrder, AdminProduct, Catalog, Collection, Customer, Go, Route, User } from './types';
import './Admin.css';

const VIEWS: Route['view'][] = ['overview', 'orders', 'customers', 'products', 'collections', 'settings'];
const NAV: { view: Route['view']; label: string; icon: IconName }[] = [
  { view: 'overview', label: 'Overview', icon: 'grid' },
  { view: 'orders', label: 'Orders', icon: 'receipt' },
  { view: 'customers', label: 'Customers', icon: 'users' },
  { view: 'products', label: 'Products', icon: 'tag' },
  { view: 'collections', label: 'Collections', icon: 'layers' },
];

/** The address bar holds the place (#/orders/ord-1?q=…), so reload and Back keep it. */
function readRoute(): Route {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const [view, id] = path.split('/');
  const params = new URLSearchParams(query);
  return {
    view: VIEWS.includes(view as Route['view']) ? (view as Route['view']) : 'overview',
    id: id ? decodeURIComponent(id) : undefined, q: params.get('q') ?? undefined, tab: params.get('tab') ?? undefined,
  };
}
function writeRoute(r: Route): string {
  const params = new URLSearchParams();
  if (r.q) params.set('q', r.q);
  if (r.tab) params.set('tab', r.tab);
  const query = params.toString();
  return `#/${r.view}${r.id ? `/${encodeURIComponent(r.id)}` : ''}${query ? `?${query}` : ''}`;
}

interface Note { id: string; icon: IconName; tone: 'green' | 'grey' | 'red'; title: string; text: string; at?: string; to: Route }
const READ_KEY = 'aurelle-admin-read';
function readSeen(): string[] {
  try { return JSON.parse(window.localStorage.getItem(READ_KEY) ?? '[]') as string[]; } catch { return []; }
}

/**
 * Staff dashboard shell: top bar (search, notifications, account), side navigation and the
 * current section. Orders are polled every 10 s so a new checkout shows up on its own. Access
 * is decided by the API (role = admin); this screen only reflects it.
 */
export default function Admin({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [route, setRoute] = useState<Route>(readRoute);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const setCatalog = useCallback((c: Catalog) => { setProducts(c.products); setCollections(c.collections); setCatalogLoaded(true); }, []);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'offline'>('loading');
  const [seen, setSeen] = useState<string[]>(readSeen);
  // Phones and tablets: the side navigation is a drawer opened from the top bar.
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); setNavOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('hashchange', onHash); document.removeEventListener('keydown', onKey); };
  }, []);
  const go: Go = useCallback((next) => { window.location.hash = writeRoute(next); }, []);

  const loadOrders = useCallback(async () => {
    const res = await api<{ orders: AdminOrder[] }>('/admin/orders');
    if (res.ok) { setOrders(res.data.orders); setState('ready'); }
    else setState(res.status === 0 ? 'offline' : 'forbidden');
  }, []);
  const loadCatalog = useCallback(async () => {
    const [p, c] = await Promise.all([api<Catalog>('/admin/products'), api<{ customers: Customer[] }>('/admin/customers')]);
    if (p.ok) setCatalog(p.data);
    if (c.ok) setCustomers(c.data.customers);
  }, [setCatalog]);

  useEffect(() => {
    const first = window.setTimeout(() => { void loadOrders(); void loadCatalog(); }, 0);
    const fast = window.setInterval(() => void loadOrders(), 10_000);
    const slow = window.setInterval(() => void loadCatalog(), 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(fast); window.clearInterval(slow); };
  }, [loadOrders, loadCatalog]);

  const toShip = orders.filter((o) => stageOf(o.status) === 'toship').length;

  const notes = useMemo<Note[]>(() => {
    const fromOrders: Note[] = orders.flatMap((o): Note[] => (
      o.status === 'confirmed' && o.paymentStatus === 'paid'
        ? [{ id: `paid:${o.id}`, icon: 'receipt', tone: 'green', title: `New paid order ${o.number}`, text: `${idr(o.costs.total)} · ready to pack`, at: o.updatedAt, to: { view: 'orders', id: o.id } }]
        : o.status === 'awaiting_payment'
          ? [{ id: `await:${o.id}`, icon: 'receipt', tone: 'grey', title: `${o.number} awaiting payment`, text: 'Stock held until the window ends', at: o.createdAt, to: { view: 'orders', id: o.id } }]
          : []
    ));
    const fromStock: Note[] = products.filter((p) => p.active).flatMap((p) => p.variants.filter((v) => v.available === 0).map((v): Note => (
      { id: `out:${v.id}`, icon: 'alert', tone: 'red', title: `${p.name.en} ${v.label.en} sold out`, text: '0 left · restock to keep selling it', to: { view: 'products', id: p.id } }
    )));
    return [...fromOrders.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')), ...fromStock].slice(0, 8);
  }, [orders, products]);
  const unread = notes.filter((n) => !seen.includes(n.id));
  const markRead = (ids: string[]) => {
    // Only what is still listed is kept, so the stored list cannot grow without bound.
    const next = [...new Set([...seen, ...ids])].filter((id) => notes.some((n) => n.id === id));
    setSeen(next);
    try { window.localStorage.setItem(READ_KEY, JSON.stringify(next)); } catch { /* private mode: read state lasts for this visit only */ }
  };

  const initials = (user.username || user.email).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'A';

  return (
    <div className="admin">
      <header className="top">
        <button type="button" id="admin-menu" className="top__icon top__menu" aria-label="Menu" aria-expanded={navOpen} aria-controls="admin-nav" onClick={() => setNavOpen((v) => !v)}><Icon name={navOpen ? 'x' : 'menu'} size={20} /></button>
        <a className="top__brand" href="#/overview" aria-label="Aurelle admin, overview">AURELLE<small>Admin</small></a>
        <GlobalSearch orders={orders} products={products} customers={customers} go={go} />
        <div className="top__end">
          <a className="top__link" id="admin-view-store" href={shopUrl} target="_blank" rel="noreferrer"><Icon name="external" />View store</a>
          <Popover id="admin-notifications" label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'} className="top__icon" panelClass="notes" trigger={<><Icon name="bell" size={18} />{unread.length > 0 && <i className="top__dot" />}</>}>
            {(close) => (
              <>
                <div className="notes__head"><h2>Notifications</h2>{unread.length > 0 && <button type="button" className="link" onClick={() => markRead(notes.map((n) => n.id))}>Mark all read</button>}</div>
                {notes.length === 0 && <p className="muted notes__empty">Nothing needs you right now.</p>}
                {notes.map((n) => (
                  <button key={n.id} type="button" className={`notes__item${seen.includes(n.id) ? '' : ' is-unread'}`} onClick={() => { markRead([n.id]); close(); go(n.to); }}>
                    <span className={`chip chip--${n.tone}`}><Icon name={n.icon} /></span>
                    <span className="notes__text"><strong>{n.title}</strong><small>{n.text}</small></span>
                    {n.at && <time dateTime={n.at}>{ago(n.at)}</time>}
                  </button>
                ))}
              </>
            )}
          </Popover>
          <Popover id="admin-account" label="Account menu" className="top__account" panelClass="menu menu--account" trigger={<><span className="avatar">{initials}</span><Icon name="chevron" size={14} /></>}>
            {(close) => (
              <>
                <div className="menu__who"><strong>{user.username}</strong><span>{user.email}</span><Pill tone="grey">Admin</Pill></div>
                <MenuItem icon="settings" onClick={() => { close(); go({ view: 'settings' }); }}>Store settings</MenuItem>
                <MenuItem icon="external" href={shopUrl} onClick={close}>View store</MenuItem>
                <hr />
                <button type="button" id="admin-logout" className="menu__item" onClick={onLogout}><Icon name="logout" />Sign out</button>
              </>
            )}
          </Popover>
        </div>
      </header>

      <div className={`shell${navOpen ? ' is-nav-open' : ''}`}>
        <div className="side__shade" onClick={() => setNavOpen(false)} />
        <nav className="side" id="admin-nav" aria-label="Dashboard sections">
          <p className="side__label">Store</p>
          {NAV.map((n) => (
            <a key={n.view} id={`admin-view-${n.view}`} href={`#/${n.view}`} aria-current={route.view === n.view ? 'page' : undefined} onClick={() => setNavOpen(false)}>
              <Icon name={n.icon} size={18} />{n.label}
              {n.view === 'orders' && toShip > 0 && <span className="side__count" aria-label={`${toShip} to ship`}>{toShip}</span>}
            </a>
          ))}
          <div className="side__foot">
            <a id="admin-view-settings" href="#/settings" aria-current={route.view === 'settings' ? 'page' : undefined} onClick={() => setNavOpen(false)}><Icon name="settings" size={18} />Settings</a>
            <a className="side__store" href={shopUrl} target="_blank" rel="noreferrer"><Icon name="external" size={18} />View store</a>
            <p className={`side__live${state === 'offline' ? ' is-down' : ''}`}><i />{state === 'offline' ? 'Server unreachable' : 'Store is live'}</p>
          </div>
        </nav>

        <main className="main">
          {state === 'forbidden' && <p className="empty" role="alert">This account does not have admin access.</p>}
          {state === 'offline' && orders.length === 0 && <p className="empty" role="alert">Could not reach the server. Make sure the API is running.</p>}
          {state === 'loading' && <p className="empty">Loading…</p>}
          {(state === 'ready' || (state === 'offline' && orders.length > 0)) && (
            route.view === 'overview' ? <Overview go={go} />
              : route.view === 'orders' ? <Orders key={`${route.q ?? ''}|${route.tab ?? ''}`} orders={orders} setOrders={setOrders} reload={loadOrders} route={route} go={go} />
                : route.view === 'customers' ? <Customers customers={customers} go={go} />
                  : route.view === 'settings' ? <Settings user={user} />
                    : route.view === 'collections' ? <Collections key={route.id ?? ''} collections={collections} products={products} loaded={catalogLoaded} setCatalog={setCatalog} route={route} go={go} />
                      : route.id === 'new' ? <ProductNew collections={collections} setCatalog={setCatalog} go={go} />
                        : route.id ? <ProductEdit key={route.id} product={products.find((p) => p.id === route.id)} collections={collections} loaded={catalogLoaded} setCatalog={setCatalog} go={go} />
                          : <Products key={route.tab ?? ''} products={products} loaded={catalogLoaded} setCatalog={setCatalog} route={route} go={go} />
          )}
        </main>
      </div>
    </div>
  );
}

/** One box for everything: order numbers, customers, products and SKUs. "/" focuses it. */
function GlobalSearch({ orders, products, customers, go }: { orders: AdminOrder[]; products: AdminProduct[]; customers: Customer[]; go: Go }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      e.preventDefault();
      input.current?.focus();
    };
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, []);

  const q = query.trim().toLowerCase();
  const has = (...texts: (string | undefined | null)[]) => texts.some((t) => t?.toLowerCase().includes(q));
  const results: { key: string; group: string; title: string; text: string; thumb?: string | null; icon: IconName; to: Route }[] = q.length < 2 ? [] : [
    ...orders.filter((o) => has(o.number, o.customer?.name, o.customer?.email)).slice(0, 4).map((o) => ({ key: o.id, group: 'Orders', title: o.number, text: `${o.customer?.name ?? ''} · ${idr(o.costs.total)}`, icon: 'receipt' as const, to: { view: 'orders' as const, id: o.id } })),
    ...products.filter((p) => has(p.name.en, p.name.id, ...p.variants.map((v) => v.sku))).slice(0, 4).map((p) => ({ key: p.id, group: 'Products', title: p.name.en, text: p.variants.map((v) => v.sku).join(', '), thumb: p.thumb, icon: 'tag' as const, to: { view: 'products' as const, id: p.id } })),
    ...customers.filter((c) => has(c.name, c.email)).slice(0, 4).map((c) => ({ key: c.id, group: 'Customers', title: c.name, text: c.email, icon: 'user' as const, to: { view: 'orders' as const, q: c.email } })),
  ];
  const pick = (to: Route) => { setOpen(false); setQuery(''); input.current?.blur(); go(to); };

  return (
    <div className="gsearch" ref={root}>
      <Icon name="search" />
      <input
        ref={input} id="admin-search" type="search" value={query} placeholder="Search orders, products, customers" aria-label="Search orders, products, customers" autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); input.current?.blur(); } if (e.key === 'Enter' && results[0]) pick(results[0].to); }}
      />
      <kbd aria-hidden="true">/</kbd>
      {open && q.length >= 2 && (
        <div className="gsearch__panel">
          {results.length === 0 && <p className="muted">Nothing matches “{query.trim()}”.</p>}
          {results.map((r, i) => (
            <div key={`${r.group}-${r.key}`}>
              {(i === 0 || results[i - 1].group !== r.group) && <p className="gsearch__group">{r.group}</p>}
              <button type="button" onClick={() => pick(r.to)}>
                {r.group === 'Products' ? <Thumb src={r.thumb} size={32} /> : <span className="chip chip--grey"><Icon name={r.icon} /></span>}
                <span><strong>{r.title}</strong><small>{r.text}</small></span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
