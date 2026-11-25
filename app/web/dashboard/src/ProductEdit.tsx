import { useEffect, useState } from 'react';
import { api } from './api';
import { CollectionPicker, VariantFields } from './ProductNew';
import { Icon, MediaEditor, Pill, Toggle } from './ui';
import { CATEGORY, CATEGORY_PLURAL, digits, emptyVariant, grouped, plural, saveError, shopUrl, stockState, variantBody, variantOk } from './lib';
import type { VariantDraft } from './lib';
import type { AdminProduct, AdminVariant, Catalog, Category, Collection, Go, SetCatalog } from './types';

interface Draft {
  name: string; descEn: string; descId: string; matEn: string; matId: string; category: Category; active: boolean;
  media: string[]; collectionIds: string[];
  variants: Record<string, { price: string; available: string }>;
}
const toDraft = (p: AdminProduct): Draft => ({
  name: p.name.en, descEn: p.description.en, descId: p.description.id, matEn: p.materials.en, matId: p.materials.id, category: p.category, active: p.active,
  media: p.media, collectionIds: p.collectionIds,
  variants: Object.fromEntries(p.variants.map((v) => [v.id, { price: String(v.priceIdr), available: String(v.available) }])),
});
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export default function ProductEdit({ product, collections, loaded, setCatalog, go }: {
  product: AdminProduct | undefined; collections: Collection[]; loaded: boolean; setCatalog: SetCatalog; go: Go;
}) {
  if (!product) return <p className="empty" role={loaded ? 'alert' : undefined}>{loaded ? 'This product no longer exists.' : 'Loading…'}</p>;
  return <Editor product={product} collections={collections} setCatalog={setCatalog} go={go} />;
}

/**
 * One product: name, descriptions, photos, category, collections, material, visibility, and
 * price and stock per variant. Those wait for Save; adding or removing a variant happens at
 * once. The API validates and audit-logs every change, and orders already placed keep the
 * price they were placed at.
 */
function Editor({ product, collections, setCatalog, go }: { product: AdminProduct; collections: Collection[]; setCatalog: SetCatalog; go: Go }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(product));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [adding, setAdding] = useState<VariantDraft | null>(null);
  const [addTried, setAddTried] = useState(false);
  const set = (patch: Partial<Draft>) => { setDraft((d) => ({ ...d, ...patch })); setNotice(null); };
  const setVariant = (id: string, patch: Partial<Draft['variants'][string]>) => { setDraft((d) => ({ ...d, variants: { ...d.variants, [id]: { ...d.variants[id], ...patch } } })); setNotice(null); };

  const body: Record<string, unknown> = {};
  const changes: string[] = [];
  if (draft.name.trim() !== product.name.en) { body.nameEn = draft.name; body.nameId = draft.name; changes.push('name'); }
  if (draft.descEn.trim() !== product.description.en) body.descriptionEn = draft.descEn;
  if (draft.descId.trim() !== product.description.id) body.descriptionId = draft.descId;
  if ('descriptionEn' in body || 'descriptionId' in body) changes.push('description');
  if (!same(draft.media, product.media)) { body.media = draft.media; changes.push('photos'); }
  if (draft.category !== product.category) { body.category = draft.category; changes.push('category'); }
  if (!sameSet(draft.collectionIds, product.collectionIds)) { body.collectionIds = draft.collectionIds; changes.push('collections'); }
  if (draft.matEn.trim() !== product.materials.en) body.materialsEn = draft.matEn;
  if (draft.matId.trim() !== product.materials.id) body.materialsId = draft.matId;
  if ('materialsEn' in body || 'materialsId' in body) changes.push('material');
  if (draft.active !== product.active) { body.active = draft.active; changes.push('visibility'); }

  const rows = product.variants.map((v) => {
    // A variant added since this page opened has no draft yet: show it as saved.
    const d = draft.variants[v.id] ?? { price: String(v.priceIdr), available: String(v.available) };
    const price = Number(d.price), available = Number(d.available);
    const priceOk = d.price !== '' && price >= 1, availableOk = d.available !== '' && available <= 100_000;
    const patch: { priceIdr?: number; available?: number } = {};
    if (priceOk && price !== v.priceIdr) { patch.priceIdr = price; changes.push(`price for ${v.label.en}`); }
    if (availableOk && available !== v.available) { patch.available = available; changes.push(`stock for ${v.label.en}`); }
    return { v, d, priceOk, availableOk, patch, soldOut: availableOk && available === 0 };
  });
  const nameOk = draft.name.trim().length >= 2;
  const valid = nameOk && rows.every((r) => r.priceOk && r.availableOk);
  const dirty = changes.length > 0 || !valid;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const calls: [string, unknown][] = [
      ...(Object.keys(body).length ? [[`/admin/products/${product.id}`, body] as [string, unknown]] : []),
      ...rows.filter((r) => Object.keys(r.patch).length).map((r) => [`/admin/variants/${r.v.id}`, r.patch] as [string, unknown]),
    ];
    let failed = 0;
    for (const [path, payload] of calls) {
      const res = await api<Catalog>(path, { method: 'PATCH', body: payload });
      if (res.ok) setCatalog(res.data);
      else failed += 1;
    }
    setBusy(false);
    // Whatever was saved now matches the product; whatever failed stays listed as unsaved.
    setNotice(failed ? { tone: 'error', text: 'Some changes could not be saved. Check the values and try again.' } : { tone: 'ok', text: 'Changes saved.' });
  };
  const leave = () => { if (!dirty || window.confirm('Leave without saving your changes?')) go({ view: 'products' }); };

  const addVariant = async () => {
    setAddTried(true);
    if (!adding || !variantOk(adding) || busy) return;
    setBusy(true);
    const res = await api<Catalog>(`/admin/products/${product.id}/variants`, { body: variantBody(adding) });
    setBusy(false);
    if (!res.ok) { setNotice({ tone: 'error', text: saveError(res.error) }); return; }
    setCatalog(res.data);
    setNotice({ tone: 'ok', text: `${adding.label.trim()} added.` });
    setAdding(null);
    setAddTried(false);
  };
  const removeVariant = async (v: AdminVariant) => {
    if (busy || !window.confirm(`Remove ${v.label.en} (${v.sku}) from this product? This cannot be undone.`)) return;
    setBusy(true);
    const res = await api<Catalog>(`/admin/variants/${v.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) setCatalog(res.data);
    setNotice(res.ok ? { tone: 'ok', text: `${v.label.en} removed.` } : { tone: 'error', text: saveError(res.error) });
  };

  const live = { ...product, variants: rows.map((r) => ({ ...r.v, available: r.availableOk ? Number(r.d.available) : r.v.available })) };
  const stock = stockState(live);
  const total = (key: 'available' | 'held' | 'sold') => live.variants.reduce((n, v) => n + v[key], 0);

  return (
    <form className="edit" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      {dirty && (
        <div className="savebar" role="status">
          <i /><strong>{changes.length ? `Unsaved changes: ${changes.join(', ')}` : 'Fix the highlighted fields to save'}</strong>
          <button type="button" id="product-discard" className="btn btn--onDark" onClick={() => { setDraft(toDraft(product)); setNotice(null); }}>Discard</button>
          <button type="submit" id="product-save" className="btn btn--light" disabled={!valid || busy || changes.length === 0}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
      {notice && <p className={`notice notice--${notice.tone}`} id="admin-product-notice" role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      <div className="page-head">
        <div className="edit__title">
          <button type="button" id="product-back" className="btn btn--icon" aria-label="Back to products" onClick={leave}><Icon name="arrowLeft" /></button>
          <div>
            <p><button type="button" className="link link--soft" onClick={leave}>Products</button> / {CATEGORY_PLURAL[product.category]}</p>
            <h1>{product.name.en}<Pill tone={stock.tone}>{stock.label}</Pill>{!product.active && <Pill tone="grey">Hidden</Pill>}</h1>
          </div>
        </div>
        <div className="page-head__actions">
          {product.active && <a className="btn" href={new URL(`/product/${product.slug}`, shopUrl).href} target="_blank" rel="noreferrer"><Icon name="external" />View in store</a>}
        </div>
      </div>

      <div className="edit__cols">
        <div className="edit__main">
          <section className="card">
            <h2>Details</h2>
            <label className="field">Product name
              <input id={`name-${product.id}`} value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} aria-invalid={!nameOk} />
              {!nameOk && <small className="field__error">Use at least 2 characters.</small>}
            </label>
            <label className="field">Description (English)<textarea id="product-desc-en" rows={3} value={draft.descEn} onChange={(e) => set({ descEn: e.target.value })} maxLength={2000} /></label>
            <label className="field">Description (Indonesian)<textarea id="product-desc-id" rows={3} value={draft.descId} onChange={(e) => set({ descId: e.target.value })} maxLength={2000} /></label>
          </section>

          <section className="card">
            <div className="card__head"><h2>Media</h2><span className="muted">{draft.media.length === 0 ? 'No photos yet' : `${plural(draft.media.length, 'photo')} · first image is the cover`}</span></div>
            <MediaEditor value={draft.media} onChange={(media) => set({ media })} />
          </section>

          <section className="card card--flush">
            <div className="card__head"><h2>Variants, prices & stock</h2>{!adding && <button type="button" id="variant-add" className="btn" disabled={product.variants.length >= 20} onClick={() => setAdding(emptyVariant())}><Icon name="plus" />Add variant</button>}</div>
            <div className="table-wrap">
              <table className="table table--cards t-variants">
                <thead><tr><th>Variant</th><th>SKU</th><th>Price</th><th>Available</th><th className="num">Held</th><th className="num">Sold</th><th><span className="sr">Remove</span></th></tr></thead>
                <tbody>
                  {rows.map(({ v, d, priceOk, availableOk, soldOut }) => (
                    <tr key={v.id}>
                      <td><strong>{v.label.en}</strong></td>
                      <td><code>{v.sku}</code></td>
                      <td>
                        <label className={`money${priceOk ? '' : ' is-invalid'}`}><span>Rp</span>
                          <input id={`price-${v.id}`} inputMode="numeric" aria-label={`Price for ${v.label.en}, in rupiah`} aria-invalid={!priceOk} value={grouped(d.price)} onChange={(e) => setVariant(v.id, { price: digits(e.target.value).slice(0, 12) })} />
                        </label>
                        {!priceOk && <small className="field__error">At least Rp 1.</small>}
                      </td>
                      <td>
                        <span className="stock">
                          <input id={`stock-${v.id}`} className={`qty${soldOut || !availableOk ? ' is-invalid' : ''}`} inputMode="numeric" aria-label={`Available stock for ${v.label.en}`} aria-invalid={!availableOk} value={d.available} onChange={(e) => setVariant(v.id, { available: digits(e.target.value).slice(0, 6) })} />
                          {soldOut && <Pill tone="red">Sold out</Pill>}
                        </span>
                        {!availableOk && <small className="field__error">0 to 100,000.</small>}
                      </td>
                      <td className="num">{v.held}</td>
                      <td className="num">{v.sold}</td>
                      <td className="end"><button type="button" id={`remove-${v.id}`} className="btn btn--icon btn--ghost" aria-label={`Remove ${v.label.en}`} disabled={busy || product.variants.length === 1} onClick={() => void removeVariant(v)}><Icon name="x" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {adding && (
              <div className="variant-new">
                <div className="variant-row">
                  <VariantFields value={adding} onChange={setAdding} show={addTried} index={product.variants.length} />
                </div>
                <div className="variant-new__actions">
                  <button type="button" className="btn" onClick={() => { setAdding(null); setAddTried(false); }}>Cancel</button>
                  <button type="button" id="variant-save" className="btn btn--primary" disabled={busy} onClick={() => void addVariant()}>Add variant</button>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="edit__side">
          <section className="card">
            <h2>Visibility</h2>
            <div className="switch-row">
              <span><strong>{draft.active ? 'Visible in store' : 'Hidden from store'}</strong><small>{draft.active ? 'Customers can find and buy it.' : 'Customers cannot see or buy it.'}</small></span>
              <Toggle id={`active-${product.id}`} checked={draft.active} label="Visible in store" onChange={(active) => set({ active })} />
            </div>
          </section>

          <section className="card">
            <h2>Organization</h2>
            <label className="field">Category
              <select id="product-category" value={draft.category} onChange={(e) => set({ category: e.target.value as Category })}>{(Object.keys(CATEGORY) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_PLURAL[c]}</option>)}</select>
            </label>
            <CollectionPicker collections={collections} value={draft.collectionIds} onChange={(collectionIds) => set({ collectionIds })} />
            <label className="field">Material (English)<input id="product-material-en" value={draft.matEn} onChange={(e) => set({ matEn: e.target.value })} maxLength={200} /></label>
            <label className="field">Material (Indonesian)<input id="product-material-id" value={draft.matId} onChange={(e) => set({ matId: e.target.value })} maxLength={200} /></label>
          </section>

          <section className="card">
            <h2>Summary</h2>
            <dl className="summary">
              <div><dt>Total available</dt><dd>{total('available')}</dd></div>
              <div><dt>Held in unpaid orders</dt><dd>{total('held')}</dd></div>
              <div><dt>Sold, all time</dt><dd>{total('sold')}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </form>
  );
}
