import { useMemo } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { products } from '../mocks/catalog';
import ProductCard from '../components/ProductCard';
import { useLocalePath } from '../hooks/useLocale';
import type { Category } from '../types/domain';
import './Shop.css';

const CATEGORIES: Category[] = ['ring', 'bracelet', 'necklace', 'earring'];
type SortKey = 'newest' | 'price-asc' | 'price-desc';

/**
 * F-04 Katalog, Pencarian & Detail Produk — halaman listing.
 * FR-04-05: search, filter (kategori, rentang harga, tipe penjualan), sort, pagination.
 * Filter disimpan di query string sehingga tetap ada saat kembali dari detail (AC-04-04).
 */
export default function Shop() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const [params, setParams] = useSearchParams();
  const pageSize = 8;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const category = params.get('category') as Category | null;
  const saleType = params.get('type');
  const query = params.get('q') ?? '';
  const sort = (params.get('sort') as SortKey) ?? 'newest';

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.active);
    if (category) list = list.filter((p) => p.category === category);
    if (saleType) list = list.filter((p) => p.saleType === saleType);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) => p.name.id.toLowerCase().includes(q) || p.name.en.toLowerCase().includes(q),
      );
    }
    const minPrice = (p: (typeof products)[number]) =>
      Math.min(...p.variants.map((v) => v.priceIdr).filter((v) => v > 0), Infinity);
    if (sort === 'price-asc') list = [...list].sort((a, b) => minPrice(a) - minPrice(b));
    if (sort === 'price-desc') list = [...list].sort((a, b) => minPrice(b) - minPrice(a));
    if (sort === 'newest') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [category, saleType, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // filter berubah → kembali ke halaman 1
    setParams(next, { replace: key === 'q' });
  };

  const setPage = (n: number) => {
    const next = new URLSearchParams(params);
    if (n > 1) next.set('page', String(n));
    else next.delete('page');
    setParams(next);
  };

  const clearAll = () => setParams(new URLSearchParams());
  const activeChips: { key: string; label: string }[] = [
    ...(category ? [{ key: 'category', label: t(`categories.${category}`) }] : []),
    ...(saleType ? [{ key: 'type', label: t(saleType === 'po' ? 'shop.preOrder' : 'shop.readyStock') }] : []),
    ...(query ? [{ key: 'q', label: `“${query}”` }] : []),
  ];
  const countFor = (c: Category) => products.filter((p) => p.active && p.category === c).length;

  return (
    <div className="container section">
      <title>{`${t('nav.shop')} — Aurelle`}</title>
      <meta name="description" content={t('shop.intro')} />
      <header className="shop-hero">
        <div className="shop-hero__copy">
          <p className="eyebrow">Shop</p>
          <h1 className="heading-xl">{query ? t('shop.searchFor', { q: query }) : category ? t(`categories.${category}`) : t('nav.shop')}</h1>
          <p className="text-muted">{t('shop.intro')}</p>
        </div>
        <nav className="shop-rail" aria-label={t('shop.category')}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              id={`shop-rail-${c}`}
              type="button"
              className={`shop-rail__item${category === c ? ' is-active' : ''}`}
              aria-pressed={category === c}
              onClick={() => updateParam('category', category === c ? null : c)}
            >
              <img src={`/media/categories/${c}.jpg`} alt="" loading="eager" />
              <span>{t(`categories.${c}`)}</span>
              <small>{countFor(c)}</small>
            </button>
          ))}
        </nav>
      </header>

      <div className="shop-layout">
        <aside className="shop-filters" aria-label={t('shop.filterLabel')}>
          <div className="shop-filters__group">
            <h3>{t('shop.category')}</h3>
            <button className={!category ? 'is-active' : ''} onClick={() => updateParam('category', null)}>
              {t('shop.all')}
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={category === c ? 'is-active' : ''}
                onClick={() => updateParam('category', c)}
              >
                {t(`categories.${c}`)}
              </button>
            ))}
          </div>
          <div className="shop-filters__group">
            <h3>{t('shop.saleType')}</h3>
            <button className={!saleType ? 'is-active' : ''} onClick={() => updateParam('type', null)}>
              {t('shop.all')}
            </button>
            <button className={saleType === 'ready_stock' ? 'is-active' : ''} onClick={() => updateParam('type', 'ready_stock')}>
              {t('shop.readyStock')}
            </button>
            <button className={saleType === 'po' ? 'is-active' : ''} onClick={() => updateParam('type', 'po')}>
              {t('shop.preOrder')}
            </button>
          </div>
        </aside>

        <div className="shop-results">
          <div className="shop-toolbar">
            <input
              id="shop-search"
              type="search"
              placeholder={t('common.search')}
              defaultValue={query}
              key={query === '' ? 'empty' : 'q'}
              onChange={(e) => updateParam('q', e.target.value || null)}
              aria-label={t('common.search')}
            />
            <span className="shop-toolbar__count" role="status">{t('shop.resultCount', { count: filtered.length })}</span>
            <select id="shop-sort" value={sort} onChange={(e) => updateParam('sort', e.target.value)} aria-label={t('shop.sortLabel')}>
              <option value="newest">{t('shop.sortNewest')}</option>
              <option value="price-asc">{t('shop.sortPriceAsc')}</option>
              <option value="price-desc">{t('shop.sortPriceDesc')}</option>
            </select>
          </div>

          {activeChips.length > 0 && (
            <div className="shop-chips" aria-label={t('shop.activeFilters')}>
              {activeChips.map((chip) => (
                <button key={chip.key} id={`shop-chip-${chip.key}`} type="button" className="shop-chip" onClick={() => updateParam(chip.key, null)}>
                  {chip.label} <span aria-hidden="true">×</span>
                </button>
              ))}
              <button id="shop-clear" type="button" className="link" onClick={clearAll}>{t('shop.clear')}</button>
            </div>
          )}

          {paged.length === 0 ? (
            <div className="shop-empty">
              <span className="shop-empty__icon" aria-hidden="true">◇</span>
              <h2 className="heading-lg">{t('shop.emptyTitle')}</h2>
              <p>{t('shop.empty')}</p>
              <div className="shop-empty__actions">
                <button id="shop-empty-clear" type="button" className="btn btn--ghost" onClick={clearAll}>{t('shop.clear')}</button>
                <NavLink id="shop-empty-custom" to={path('/custom-po')} className="btn btn--primary">{t('shop.customCta')}</NavLink>
              </div>
            </div>
          ) : (
            <div className="grid grid-3 shop-grid">
              {paged.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="shop-pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={n === page ? 'is-active' : ''} onClick={() => setPage(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
