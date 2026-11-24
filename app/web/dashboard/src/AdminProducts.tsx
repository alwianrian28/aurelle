import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Category } from './types';

interface AdminVariant { id: string; sku: string; label: { id: string; en: string }; priceIdr: number; available: number; held: number }
interface AdminProduct { id: string; name: { id: string; en: string }; category: Category; thumb?: string; active: boolean; variants: AdminVariant[] }

const CATEGORY: Record<Category, string> = { necklace: 'Necklace', earring: 'Earrings', ring: 'Ring', bracelet: 'Bracelet' };
const idr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

/**
 * Catalog desk: rename a product, show or hide it in the shop, and set price and available
 * stock per variant. Every change is validated and audit-logged by the API; orders already
 * placed keep the price they were placed at.
 */
export default function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const res = await api<{ products: AdminProduct[] }>('/admin/products');
    if (res.ok) setProducts(res.data.products);
    else setNotice({ tone: 'error', text: 'Could not load products.' });
  }, []);
  useEffect(() => { const first = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(first); }, [load]);

  const save = async (path: string, body: unknown, done: string) => {
    const res = await api<{ products: AdminProduct[] }>(path, { method: 'PATCH', body });
    if (res.ok) { setProducts(res.data.products); setNotice({ tone: 'ok', text: done }); }
    else setNotice({ tone: 'error', text: res.error === 'invalid_input' ? 'Invalid value: price must be at least Rp 1, stock cannot be negative, name needs at least 2 characters.' : 'Could not save. Try again.' });
    return res.ok;
  };

  if (!products) return <p className="admin__empty">{notice?.text ?? 'Loading…'}</p>;
  const q = query.trim().toLowerCase();
  const shown = products.filter((p) => !q || p.name.id.toLowerCase().includes(q) || p.name.en.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)));

  return (
    <>
      <div className="admin__toolbar">
        <label>Search products<input id="admin-product-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or SKU" /></label>
        <span>{shown.length} of {products.length} products</span>
      </div>
      {notice && <p className={`admin__notice${notice.tone === 'ok' ? ' admin__notice--ok' : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'} id="admin-product-notice">{notice.text}</p>}
      <div className="admin__products">
        {shown.map((p) => <ProductRow key={p.id} product={p} save={save} />)}
        {shown.length === 0 && <p className="admin__empty">No matching products.</p>}
      </div>
    </>
  );
}

function ProductRow({ product, save }: { product: AdminProduct; save: (path: string, body: unknown, done: string) => Promise<boolean> }) {
  const [name, setName] = useState(product.name.en);
  const dirty = name.trim() !== product.name.en;
  return (
    <section className={`admin__product${product.active ? '' : ' is-hidden'}`} aria-label={product.name.en}>
      <div className="admin__product-head">
        {product.thumb && <img src={product.thumb} alt="" width="56" height="70" loading="lazy" />}
        <form className="admin__product-name" onSubmit={(e) => { e.preventDefault(); if (dirty) void save(`/admin/products/${product.id}`, { nameId: name, nameEn: name }, 'Product name saved.'); }}>
          <label>Product name · {CATEGORY[product.category]}<input id={`name-${product.id}`} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></label>
          <button type="submit" disabled={!dirty}>Save name</button>
        </form>
        <label className="admin__switch">
          <input id={`active-${product.id}`} type="checkbox" checked={product.active} onChange={(e) => void save(`/admin/products/${product.id}`, { active: e.target.checked }, e.target.checked ? 'Product is now visible in the store.' : 'Product is now hidden from the store.')} />
          {product.active ? 'Visible in store' : 'Hidden'}
        </label>
      </div>
      <table>
        <thead><tr><th>Variant</th><th>SKU</th><th>Price (Rp)</th><th>Available stock</th><th>Held / sold</th><th /></tr></thead>
        <tbody>{product.variants.map((v) => <VariantRow key={`${v.id}-${v.priceIdr}-${v.available}`} variant={v} save={save} />)}</tbody>
      </table>
    </section>
  );
}

function VariantRow({ variant, save }: { variant: AdminVariant; save: (path: string, body: unknown, done: string) => Promise<boolean> }) {
  const [price, setPrice] = useState(String(variant.priceIdr));
  const [available, setAvailable] = useState(String(variant.available));
  const priceNum = Number(price);
  const availableNum = Number(available);
  const valid = Number.isInteger(priceNum) && priceNum >= 1 && Number.isInteger(availableNum) && availableNum >= 0;
  const dirty = priceNum !== variant.priceIdr || availableNum !== variant.available;
  const form = `variant-${variant.id}`;
  return (
    <tr>
      <td>{variant.label.en}</td>
      <td><small>{variant.sku}</small></td>
      <td><input form={form} id={`price-${variant.id}`} aria-label={`Price for ${variant.label.en}`} type="number" inputMode="numeric" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} /><small>{valid ? idr(priceNum) : 'Invalid'}</small></td>
      <td><input form={form} id={`stock-${variant.id}`} aria-label={`Available stock for ${variant.label.en}`} type="number" inputMode="numeric" min={0} step={1} value={available} onChange={(e) => setAvailable(e.target.value)} /></td>
      <td>{variant.held}</td>
      <td>
        <form id={form} onSubmit={(e) => { e.preventDefault(); if (valid && dirty) void save(`/admin/variants/${variant.id}`, { priceIdr: priceNum, available: availableNum }, `${variant.sku} saved.`); }}>
          <button type="submit" id={`save-${variant.id}`} disabled={!valid || !dirty}>Save</button>
        </form>
      </td>
    </tr>
  );
}
