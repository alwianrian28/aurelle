import { useState } from 'react';
import { api } from './api';
import { Icon, MediaEditor, Toggle } from './ui';
import { CATEGORY, CATEGORY_PLURAL, digits, emptyVariant, grouped, saveError, variantBody, variantOk, variantProblems } from './lib';
import type { VariantDraft } from './lib';
import type { Catalog, Category, Collection, Go, SetCatalog } from './types';

/** One variant's fields in a row: label, SKU, price, stock. Marks what is wrong once `show` is on. */
export function VariantFields({ value, onChange, show, index }: { value: VariantDraft; onChange: (next: VariantDraft) => void; show: boolean; index: number }) {
  const bad = variantProblems(value);
  const set = (patch: Partial<VariantDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <label className="field">Variant<input id={`variant-label-${index}`} value={value.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Size 7" maxLength={60} aria-invalid={show && bad.label} /></label>
      <label className="field">SKU<input id={`variant-sku-${index}`} value={value.sku} onChange={(e) => set({ sku: e.target.value.toUpperCase() })} placeholder="e.g. MOON-RING-7" maxLength={80} aria-invalid={show && bad.sku} /></label>
      <label className="field">Price
        <span className={`money${show && bad.price ? ' is-invalid' : ''}`}><span>Rp</span><input id={`variant-price-${index}`} inputMode="numeric" value={grouped(value.price)} onChange={(e) => set({ price: digits(e.target.value).slice(0, 12) })} aria-invalid={show && bad.price} /></span>
      </label>
      <label className="field">Stock<input id={`variant-stock-${index}`} className="qty" inputMode="numeric" value={value.available} onChange={(e) => set({ available: digits(e.target.value).slice(0, 6) })} aria-invalid={show && bad.available} /></label>
    </>
  );
}

/**
 * A new product: details, photos, and at least one variant with its SKU, price and stock.
 * It starts hidden unless switched on here, so it can be checked before customers see it.
 */
export default function ProductNew({ collections, setCatalog, go }: { collections: Collection[]; setCatalog: SetCatalog; go: Go }) {
  const [name, setName] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descId, setDescId] = useState('');
  const [matEn, setMatEn] = useState('');
  const [matId, setMatId] = useState('');
  const [category, setCategory] = useState<Category>('ring');
  const [active, setActive] = useState(false);
  const [media, setMedia] = useState<string[]>([]);
  const [inCollections, setInCollections] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const nameOk = name.trim().length >= 2;
  const skus = variants.map((v) => v.sku.trim().toUpperCase());
  const repeated = skus.some((s, i) => s && skus.indexOf(s) !== i);
  const valid = nameOk && variants.every(variantOk) && !repeated;
  const touched = name !== '' || descEn !== '' || descId !== '' || media.length > 0 || variants.some((v) => v.label !== '' || v.sku !== '' || v.price !== '');

  const save = async () => {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    const res = await api<Catalog & { id: string }>('/admin/products', {
      body: { nameEn: name, category, descriptionEn: descEn, descriptionId: descId, materialsEn: matEn, materialsId: matId, active, media, collectionIds: inCollections, variants: variants.map(variantBody) },
    });
    setBusy(false);
    if (!res.ok) { setError(saveError(res.error)); return; }
    setCatalog(res.data);
    go({ view: 'products', id: res.data.id });
  };
  const leave = () => { if (!touched || window.confirm('Leave without saving this product?')) go({ view: 'products' }); };

  return (
    <form className="edit" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <div className="page-head">
        <div className="edit__title">
          <button type="button" id="product-back" className="btn btn--icon" aria-label="Back to products" onClick={leave}><Icon name="arrowLeft" /></button>
          <div><p><button type="button" className="link link--soft" onClick={leave}>Products</button> / New</p><h1>Add product</h1></div>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn" onClick={leave}>Cancel</button>
          <button type="submit" id="product-create" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
        </div>
      </div>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {tried && !valid && !error && <p className="notice notice--error" role="alert">{repeated ? 'Two variants share the same SKU. Each needs its own.' : 'Fill in the highlighted fields to save.'}</p>}

      <div className="edit__cols">
        <div className="edit__main">
          <section className="card">
            <h2>Details</h2>
            <label className="field">Product name
              <input id="product-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={tried && !nameOk} autoFocus />
              {tried && !nameOk && <small className="field__error">Use at least 2 characters.</small>}
            </label>
            <label className="field">Description (English)<textarea id="product-desc-en" rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} maxLength={2000} /></label>
            <label className="field">Description (Indonesian)<textarea id="product-desc-id" rows={3} value={descId} onChange={(e) => setDescId(e.target.value)} maxLength={2000} /></label>
          </section>

          <section className="card">
            <div className="card__head"><h2>Media</h2><span className="muted">{media.length === 0 ? 'No photos yet' : 'First image is the cover'}</span></div>
            <MediaEditor value={media} onChange={setMedia} />
          </section>

          <section className="card">
            <div className="card__head"><h2>Variants, prices & stock</h2><button type="button" id="variant-add" className="btn" disabled={variants.length >= 20} onClick={() => setVariants([...variants, emptyVariant()])}><Icon name="plus" />Add variant</button></div>
            <p className="muted">One row per size or length. A product with a single option still needs one variant, for example “One size”.</p>
            {variants.map((v, i) => (
              <div className="variant-row" key={i}>
                <VariantFields value={v} index={i} show={tried} onChange={(next) => setVariants(variants.map((x, n) => (n === i ? next : x)))} />
                <button type="button" className="btn btn--icon btn--ghost" aria-label={`Remove variant ${i + 1}`} disabled={variants.length === 1} onClick={() => setVariants(variants.filter((_, n) => n !== i))}><Icon name="x" /></button>
              </div>
            ))}
          </section>
        </div>

        <aside className="edit__side">
          <section className="card">
            <h2>Visibility</h2>
            <div className="switch-row">
              <span><strong>{active ? 'Visible in store' : 'Hidden from store'}</strong><small>{active ? 'Customers can buy it as soon as it is saved.' : 'Saved as a draft; switch it on when it is ready.'}</small></span>
              <Toggle id="product-active" checked={active} label="Visible in store" onChange={setActive} />
            </div>
          </section>

          <section className="card">
            <h2>Organization</h2>
            <label className="field">Category
              <select id="product-category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>{(Object.keys(CATEGORY) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_PLURAL[c]}</option>)}</select>
            </label>
            <CollectionPicker collections={collections} value={inCollections} onChange={setInCollections} />
            <label className="field">Material (English)<input id="product-material-en" value={matEn} onChange={(e) => setMatEn(e.target.value)} maxLength={200} /></label>
            <label className="field">Material (Indonesian)<input id="product-material-id" value={matId} onChange={(e) => setMatId(e.target.value)} maxLength={200} /></label>
          </section>
        </aside>
      </div>
    </form>
  );
}

/** Which collections a product belongs to, as a checklist. */
export function CollectionPicker({ collections, value, onChange }: { collections: Collection[]; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <fieldset className="field picks">
      <legend>Collections</legend>
      {collections.length === 0 && <p className="muted">No collections yet.</p>}
      {collections.map((c) => (
        <label key={c.id}>
          <input type="checkbox" checked={value.includes(c.id)} onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((id) => id !== c.id))} />
          {c.name.en}{!c.active && <small>hidden</small>}
        </label>
      ))}
    </fieldset>
  );
}
