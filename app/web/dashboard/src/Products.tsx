import { useState } from 'react';
import { api } from './api';
import { ExportMenu, Icon, Pager, Pill, Popover, Select, Tabs, Thumb, Toggle } from './ui';
import { CATEGORY, CATEGORY_PLURAL, PAGE, idr, plural, stockState, variantSummary } from './lib';
import type { Report } from './export';
import type { AdminProduct, Catalog, Category, Go, Route, SetCatalog } from './types';

type Tab = 'all' | 'visible' | 'hidden' | 'restock';
type Sort = 'name' | 'name-desc' | 'price' | 'price-desc' | 'stock';
const CATEGORIES = Object.keys(CATEGORY) as Category[];
const minPrice = (p: AdminProduct) => Math.min(...p.variants.map((v) => v.priceIdr));
const available = (p: AdminProduct) => p.variants.reduce((n, v) => n + v.available, 0);
const SORT: Record<Sort, (a: AdminProduct, b: AdminProduct) => number> = {
  name: (a, b) => a.name.en.localeCompare(b.name.en),
  'name-desc': (a, b) => b.name.en.localeCompare(a.name.en),
  price: (a, b) => minPrice(a) - minPrice(b),
  'price-desc': (a, b) => minPrice(b) - minPrice(a),
  stock: (a, b) => available(a) - available(b),
};

/**
 * Catalog desk: every product with its price, what is left to sell, and whether the shop
 * shows it. Visibility changes at once; names, prices and stock are edited on the product page.
 */
export default function Products({ products, loaded, setCatalog, route, go }: {
  products: AdminProduct[]; loaded: boolean; setCatalog: SetCatalog; route: Route; go: Go;
}) {
  const [tab, setTab] = useState<Tab>(['visible', 'hidden', 'restock'].includes(route.tab ?? '') ? (route.tab as Tab) : 'all');
  const [query, setQuery] = useState('');
  const [cats, setCats] = useState<Category[]>([]);
  const [sort, setSort] = useState<Sort>('name');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE);
  const [picked, setPicked] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  /** Shows or hides products in the shop, one request each; the last answer carries the whole list. */
  const setActive = async (ids: string[], active: boolean) => {
    let failed = 0;
    for (const id of ids) {
      const res = await api<Catalog>(`/admin/products/${id}`, { method: 'PATCH', body: { active } });
      if (res.ok) setCatalog(res.data);
      else failed += 1;
    }
    const what = ids.length === 1 ? (products.find((p) => p.id === ids[0])?.name.en ?? 'Product') : `${ids.length - failed} products`;
    setNotice(failed ? { tone: 'error', text: `Could not update ${plural(failed, 'product')}. Try again.` } : { tone: 'ok', text: `${what} ${ids.length === 1 ? 'is' : 'are'} now ${active ? 'visible in' : 'hidden from'} the store.` });
    setPicked([]);
  };

  const q = query.trim().toLowerCase();
  const base = products.filter((p) => (
    (!q || p.name.en.toLowerCase().includes(q) || p.name.id.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)))
    && (cats.length === 0 || cats.includes(p.category))
  ));
  const inTab = (p: AdminProduct, t: Tab) => t === 'all' || (t === 'visible' ? p.active : t === 'hidden' ? !p.active : stockState(p).restock);
  const shown = base.filter((p) => inTab(p, tab)).sort(SORT[sort]);
  const rows = shown.slice(page * size, (page + 1) * size);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); setPicked([]); };
  const allPicked = rows.length > 0 && rows.every((p) => picked.includes(p.id));
  const restock = products.filter((p) => stockState(p).restock).length;

  /** One row per variant: that is the unit that has a SKU, a price and stock. */
  const report = (): Report => {
    const variants = shown.flatMap((p) => p.variants.map((v) => ({ p, v })));
    const sum = (key: 'available' | 'held' | 'sold') => variants.reduce((n, { v }) => n + v[key], 0);
    const filters = [tab !== 'all' && { visible: 'visible in store', hidden: 'hidden from store', restock: 'needing restock' }[tab], cats.length > 0 && cats.map((c) => CATEGORY_PLURAL[c]).join(' and '), q && `matching "${query.trim()}"`].filter(Boolean);
    return {
      file: 'aurelle-products',
      title: 'Products, prices & stock',
      subtitle: `${plural(shown.length, 'product')}, ${plural(variants.length, 'variant')}${filters.length ? ` (${filters.join(', ')})` : ''}`,
      columns: [
        { header: 'Product', width: 28, flex: true }, { header: 'Category', width: 13 }, { header: 'Variant', width: 16 }, { header: 'SKU', width: 26 }, { header: 'Price', kind: 'money', width: 16 },
        { header: 'Available', kind: 'int', width: 11 }, { header: 'Held', kind: 'int', width: 8 }, { header: 'Sold', kind: 'int', width: 8 }, { header: 'In store', width: 11 },
      ],
      rows: variants.map(({ p, v }) => [p.name.en, CATEGORY[p.category], v.label.en, v.sku, v.priceIdr, v.available, v.held, v.sold, p.active ? 'Visible' : 'Hidden']),
      totals: ['Total', null, plural(variants.length, 'variant'), null, null, sum('available'), sum('held'), sum('sold'), null],
    };
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Products, prices & stock</h1><p>{plural(products.length, 'product')}{restock > 0 ? ` · ${restock} need restock` : ''}</p></div>
        <div className="page-head__actions"><ExportMenu id="products-export" report={report} disabled={shown.length === 0} /><button type="button" id="products-add" className="btn btn--primary" onClick={() => go({ view: 'products', id: 'new' })}><Icon name="plus" />Add product</button></div>
      </div>
      {notice && <p className={`notice notice--${notice.tone}`} id="admin-product-notice" role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      <section className="card card--flush">
        <Tabs label="Products by state" value={tab} onChange={reset(setTab)} tabs={[['all', 'All', base.length], ['visible', 'Visible', base.filter((p) => inTab(p, 'visible')).length], ['hidden', 'Hidden', base.filter((p) => inTab(p, 'hidden')).length], ['restock', 'Needs restock', base.filter((p) => inTab(p, 'restock')).length]]} />
        <div className="toolbar">
          <label className="search"><Icon name="search" /><input id="admin-product-search" type="search" value={query} onChange={(e) => reset(setQuery)(e.target.value)} placeholder="Search by name or SKU" aria-label="Search products" /></label>
          <Popover id="products-category" label="Filter by category" className={`btn${cats.length ? ' is-on' : ''}`} panelClass="filter" trigger={<><Icon name="filter" />Category{cats.length ? ` · ${cats.length}` : ''}<Icon name="chevron" size={14} /></>}>
            {(close) => <CategoryFilter products={products} value={cats} onApply={(next) => { reset(setCats)(next); close(); }} />}
          </Popover>
          <Select id="products-sort" label="Sort" value={sort} onChange={reset(setSort)} options={[['name', 'Name A–Z'], ['name-desc', 'Name Z–A'], ['price', 'Price, low to high'], ['price-desc', 'Price, high to low'], ['stock', 'Stock, low to high']]} />
        </div>
        {picked.length > 0 && (
          <div className="bulk" role="group" aria-label="Selected products">
            <span>{picked.length} selected</span>
            <button type="button" className="btn" onClick={() => void setActive(picked, true)}>Show in store</button>
            <button type="button" className="btn" onClick={() => void setActive(picked, false)}>Hide from store</button>
            <button type="button" className="link" onClick={() => setPicked([])}>Clear</button>
          </div>
        )}

        <div className="table-wrap">
          <table className="table table--cards t-products">
            <thead>
              <tr>
                <th className="check"><input type="checkbox" aria-label="Select all products on this page" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...rows.map((p) => p.id)])] : picked.filter((id) => !rows.some((p) => p.id === id)))} /></th>
                <th>Product</th><th>Variants</th><th>Price</th><th>Available</th><th>Status</th><th>Visible</th><th><span className="sr">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const stock = stockState(p);
                const prices = new Set(p.variants.map((v) => v.priceIdr));
                return (
                  <tr key={p.id} className={p.active ? '' : 'is-off'}>
                    <td className="check"><input type="checkbox" aria-label={`Select ${p.name.en}`} checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((id) => id !== p.id))} /></td>
                    <td><span className="product"><Thumb src={p.thumb} /><span><button type="button" className="table__key" onClick={() => go({ view: 'products', id: p.id })}>{p.name.en}</button><small>{CATEGORY[p.category]}</small></span></span></td>
                    <td className="soft">{variantSummary(p)}</td>
                    <td className="nowrap">{prices.size > 1 ? 'From ' : ''}{idr(minPrice(p))}</td>
                    <td>{available(p)}</td>
                    <td><Pill tone={stock.tone}>{stock.label}</Pill></td>
                    <td><Toggle id={`active-${p.id}`} checked={p.active} label={`${p.name.en} visible in store`} onChange={(next) => void setActive([p.id], next)} /></td>
                    <td className="end"><button type="button" className="link" id={`edit-${p.id}`} onClick={() => go({ view: 'products', id: p.id })}>Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="empty">{!loaded ? 'Loading…' : products.length === 0 ? 'No products yet. Add the first one.' : 'No products match these filters.'}</p>}
        </div>
        <Pager id="products" page={page} total={shown.length} size={size} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); setPicked([]); }} />
      </section>
    </>
  );
}

/** Category checklist; nothing changes in the table until Apply. */
function CategoryFilter({ products, value, onApply }: { products: AdminProduct[]; value: Category[]; onApply: (next: Category[]) => void }) {
  const [draft, setDraft] = useState<Category[]>(value);
  return (
    <>
      <p className="filter__title">Category</p>
      {CATEGORIES.map((c) => (
        <label key={c}>
          <input type="checkbox" checked={draft.includes(c)} onChange={(e) => setDraft(e.target.checked ? [...draft, c] : draft.filter((x) => x !== c))} />
          {CATEGORY_PLURAL[c]}<span>{products.filter((p) => p.category === c).length}</span>
        </label>
      ))}
      <div className="filter__foot">
        <button type="button" className="link link--plain" onClick={() => onApply([])}>Clear</button>
        <button type="button" id="products-category-apply" className="btn btn--primary" onClick={() => onApply(draft)}>Apply</button>
      </div>
    </>
  );
}
