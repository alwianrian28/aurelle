import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { products } from '../mocks/catalog';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
import { getAvailableStock } from '../store/orderStore';
import { useCatalogVersion } from '../lib/catalogSync';
import ProductCard from '../components/ProductCard';
import SmartImage from '../components/SmartImage';
import SortMenu from '../components/SortMenu';
import { scrollToTop } from '../lib/gsap';
import type { Category, Product } from '../types/domain';
import './Shop.css';

const CATEGORIES: Category[] = ['ring', 'bracelet', 'necklace', 'earring'];
type SortKey = 'newest' | 'featured' | 'price-asc' | 'price-desc';
/** Pieces in the first view; "Load more" then shows the whole catalog. */
const FIRST_VIEW = 8;
/** The piece featured in the editorial tile of the first view. */
const EDIT_PRODUCT_ID = 'kalung-berlapis';

const minPrice = (p: Product) => Math.min(...p.variants.map((v) => v.priceIdr).filter((v) => v > 0), Infinity);

/**
 * F-04 catalog listing (FR-04-05: search, filter, sort).
 * First view: eight pieces and an editorial tile. "Load more" opens the whole catalog,
 * grouped by category when nothing narrows it. Every choice lives in the query string, so
 * it survives a trip to a product and back (AC-04-04).
 */
export default function Shop() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  const [params, setParams] = useSearchParams();
  useCatalogVersion(); // stock filter follows server refreshes

  const category = CATEGORIES.find((c) => c === params.get('category')) ?? null;
  const query = params.get('q') ?? '';
  const sort = (['newest', 'featured', 'price-asc', 'price-desc'] as const).find((s) => s === params.get('sort')) ?? 'newest';
  const inStockOnly = params.get('stock') === '1';
  const expanded = params.get('view') === 'all';
  const [filtersOpen, setFiltersOpen] = useState(Boolean(query) || inStockOnly);

  // On phones the pills scroll sideways: keep the selected one in view (the row only, not the page).
  const pills = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = pills.current;
    const selected = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && selected) row.scrollLeft = selected.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2;
  }, [category]);

  const active = useMemo(() => products.filter((p) => p.active), []);
  const filtered = useMemo(() => {
    let list = active;
    if (category) list = list.filter((p) => p.category === category);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.en.toLowerCase().includes(q));
    }
    if (inStockOnly) list = list.filter((p) => p.variants.some((v) => getAvailableStock(v.id) > 0));
    if (sort === 'price-asc') list = [...list].sort((a, b) => minPrice(a) - minPrice(b));
    if (sort === 'price-desc') list = [...list].sort((a, b) => minPrice(b) - minPrice(a));
    if (sort === 'newest') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list; // 'featured' keeps the catalog's own order
  }, [active, category, query, inStockOnly, sort]);

  /** Sets or clears one choice. Narrowing the list returns to the first view. */
  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'view' && key !== 'sort') next.delete('view');
    setParams(next, { replace: key === 'q' });
  };
  const clearAll = () => setParams(new URLSearchParams());

  const narrowed = Boolean(category || query || inStockOnly);
  const edit = narrowed ? undefined : active.find((p) => p.id === EDIT_PRODUCT_ID);
  // The edit piece has its own tile in the first view, so it leaves the grid there.
  const firstView = (edit ? filtered.filter((p) => p.id !== edit.id) : filtered).slice(0, FIRST_VIEW);
  const hasMore = filtered.length > firstView.length;
  const showAll = expanded || !hasMore;
  const shown = showAll ? filtered.length : firstView.length;
  const groups = CATEGORIES.map((c) => ({ category: c, items: filtered.filter((p) => p.category === c) })).filter((g) => g.items.length > 0);

  const chips: { key: string; label: string }[] = [
    ...(query ? [{ key: 'q', label: `“${query}”` }] : []),
    ...(inStockOnly ? [{ key: 'stock', label: t('shop.inStock') }] : []),
  ];
  const title = query ? t('shop.searchFor', { q: query }) : category ? t(`categories.${category}`) : t('shop.allJewelry');

  return (
    <div className="shop">
      <div className="container">
        <title>{`${title} — Aurelle`}</title>
        <meta name="description" content={t('shop.intro')} />

        <nav className="shop__crumbs" aria-label={t('product.breadcrumb')}>
          <ol>
            <li><NavLink id="shop-crumb-home" to={path('/store')}>{t('product.home')}</NavLink></li>
            <li aria-current="page">{t('nav.shop')}</li>
          </ol>
        </nav>

        <header className="shop__head">
          <h1>{title}</h1>
          <p>{t('shop.intro')}</p>
        </header>

        <div className="shop__bar">
          <div className="shop__pills" ref={pills} role="group" aria-label={t('shop.category')}>
            <button id="shop-cat-all" type="button" aria-pressed={!category} onClick={() => update('category', null)}>{t('shop.all')}<small>{active.length}</small></button>
            {CATEGORIES.map((c) => (
              <button key={c} id={`shop-cat-${c}`} type="button" aria-pressed={category === c} onClick={() => update('category', c)}>
                {t(`categories.${c}`)}<small>{active.filter((p) => p.category === c).length}</small>
              </button>
            ))}
          </div>
          <div className="shop__tools">
            <button id="shop-filter" type="button" className="shop__filter-btn" aria-expanded={filtersOpen} aria-controls="shop-filters" onClick={() => setFiltersOpen((o) => !o)}>
              <FilterIcon />{t('shop.filter')}{chips.length > 0 && <small>{chips.length}</small>}
            </button>
            <SortMenu<SortKey>
              id="shop-sort"
              label={t('shop.sortLabel')}
              value={sort}
              onChange={(value) => update('sort', value === 'newest' ? null : value)}
              options={[
                { value: 'newest', label: t('shop.sortNewest') },
                { value: 'featured', label: t('shop.sortFeatured') },
                { value: 'price-asc', label: t('shop.sortPriceAsc') },
                { value: 'price-desc', label: t('shop.sortPriceDesc') },
              ]}
            />
          </div>
        </div>

        <div id="shop-filters" className="shop__filters" hidden={!filtersOpen}>
          <input
            id="shop-search"
            type="search"
            placeholder={t('shop.searchPlaceholder')}
            defaultValue={query}
            key={query === '' ? 'empty' : 'q'}
            onChange={(e) => update('q', e.target.value || null)}
            aria-label={t('common.search')}
          />
          <label className="shop__check">
            <input id="shop-in-stock" type="checkbox" checked={inStockOnly} onChange={(e) => update('stock', e.target.checked ? '1' : null)} />
            {t('shop.inStock')}
          </label>
          {chips.length > 0 && <button id="shop-clear" type="button" className="shop__link" onClick={clearAll}>{t('shop.clear')}</button>}
        </div>
        <p className="visually-hidden" role="status">{t('shop.resultCount', { count: filtered.length })}</p>

        {filtered.length === 0 ? (
          <div className="shop__empty">
            <h2>{t('shop.emptyTitle')}</h2>
            <p>{t('shop.empty')}</p>
            <button id="shop-empty-clear" type="button" className="shop__more" onClick={clearAll}>{t('shop.clear')}</button>
          </div>
        ) : !showAll ? (
          <>
            <div className="shop__grid">
              {firstView.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
              {edit && (
                <NavLink id="shop-edit" to={path(`/product/${edit.slug}`)} className="shop__edit">
                  <span className="shop__edit-media"><SmartImage src={edit.media[0]?.src} alt={localized(edit.media[0]?.alt)} category={edit.category} /></span>
                  <span className="shop__edit-copy">
                    <span>
                      <small>{t('shop.editEyebrow')}</small>
                      <strong>{t('shop.editTitle')}</strong>
                      <span>{t('shop.editBody', { name: localized(edit.name) })}</span>
                    </span>
                    <em>{t('shop.editCta')}</em>
                  </span>
                </NavLink>
              )}
              {firstView.slice(4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            <div className="shop__progress">
              <p>{t('shop.showing', { shown, total: filtered.length })}</p>
              <span aria-hidden="true"><i style={{ width: `${(shown / filtered.length) * 100}%` }} /></span>
              <button id="shop-load-more" type="button" className="shop__more" onClick={() => update('view', 'all')}>{t('shop.loadMore')}</button>
            </div>
          </>
        ) : (
          <>
            {narrowed ? (
              <div className="shop__grid">{filtered.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            ) : groups.map((group) => (
              <section key={group.category} className="shop__group" aria-labelledby={`shop-group-${group.category}`}>
                <div className="shop__group-head">
                  <h2 id={`shop-group-${group.category}`}>{t(`categories.${group.category}`)}<small>{t('shop.pieces', { count: group.items.length })}</small></h2>
                  <button id={`shop-only-${group.category}`} type="button" className="shop__link" onClick={() => { update('category', group.category); scrollToTop(false); }}>
                    {t('shop.viewOnly', { category: t(`categories.${group.category}`) })}
                  </button>
                </div>
                <div className="shop__grid">{group.items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              </section>
            ))}
            {hasMore && (
              <div className="shop__end">
                <p>{t('shop.seenAll', { count: filtered.length })}</p>
                <button id="shop-back-to-top" type="button" className="shop__link" onClick={() => scrollToTop()}>{t('footer.backToTop')} ↑</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" /><circle cx="15" cy="8" r="2" /><circle cx="9" cy="16" r="2" />
    </svg>
  );
}
