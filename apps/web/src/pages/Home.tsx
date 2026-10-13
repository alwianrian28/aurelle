import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale, useLocalePath } from '../hooks/useLocale';
import { products } from '../mocks/catalog';
import ProductCard from '../components/ProductCard';
import NewsletterForm from '../components/NewsletterForm';
import type { Category } from '../types/domain';
import './Home.css';

/** Static editorial storefront; cinematic 3D is isolated on the entrance route. */
export default function Home() {
  const id = useLocale() === 'id';
  const path = useLocalePath();
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState<Category | ''>('');
  const [sort, setSort] = useState('featured');
  const listed = useMemo(() => {
    const list = products.filter(p => p.active && (!category || p.category === category));
    const price = (p: typeof products[number]) => Math.min(...p.variants.map(v => v.priceIdr).filter(n => n > 0), Infinity);
    if (sort === 'low') list.sort((a, b) => price(a) - price(b));
    if (sort === 'high') list.sort((a, b) => price(b) - price(a));
    return list;
  }, [category, sort]);
  return <div className="storefront">
    <title>Aurelle — Silver Luxury Jewelry</title>
    <meta name="description" content={id ? 'Jelajahi koleksi Aurelle: cincin, gelang, kalung dan anting dengan tampilan silver.' : 'Explore Aurelle rings, bracelets, necklaces and earrings in a refined silver aesthetic.'} />
    <section className="storefront__hero" aria-labelledby="store-title">
      <img src="/media/editorial/Hero_1.png" alt={id ? 'Detail kalung berlapis dan cincin silver dengan busana putih' : 'Layered silver necklaces and rings styled with a white blouse'} width="1024" height="537" fetchPriority="high" />
      <div className="storefront__hero-copy">
        <h1 id="store-title">{id ? 'Temukan Koleksimu' : 'Shop the Collection'}</h1>
        <p>{id ? 'Garis yang lembut. Kilau yang tenang. Temukan perhiasan untuk melengkapi setiap cerita Anda.' : 'Delicate lines. A quieter kind of shine. Discover jewelry made to complement your every story.'}</p>
        <a id="store-explore" href="#store-collection">{id ? 'JELAJAHI KOLEKSI' : 'EXPLORE THE COLLECTION'} ↗</a>
      </div>
    </section>
    <div className="storefront__benefits" aria-label={id ? 'Layanan Aurelle' : 'Aurelle services'}>
      <span>{id ? 'Koleksi berpenampilan silver' : 'Silver-look collections'}</span>
      <span>{id ? 'Pilihan ready stock' : 'Ready-stock selection'}</span>
      <span>{id ? 'Konsultasi custom & PO' : 'Custom & PO consultation'}</span>
      <span>IDR / USD · ID / EN</span>
    </div>
    <section id="store-collection" aria-label={t('nav.shop')}>
      <div className="storefront__toolbar">
        <button id="store-filter-toggle" aria-expanded={filtersOpen} aria-controls="store-filters" onClick={() => setFiltersOpen(!filtersOpen)}>{id ? 'Filter' : 'Filters'} {filtersOpen ? '−' : '+'}</button>
        <span role="status">{id ? `${listed.length} produk` : `${listed.length} pieces`}</span>
        <select id="store-sort" aria-label={t('shop.sortLabel')} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="featured">{id ? 'Pilihan koleksi' : 'Collection edit'}</option>
          <option value="low">{t('shop.sortPriceAsc')}</option>
          <option value="high">{t('shop.sortPriceDesc')}</option>
        </select>
      </div>
      <div id="store-filters" className="storefront__filters" hidden={!filtersOpen} style={!filtersOpen ? { display: 'none' } : undefined}>
        {(['', 'ring', 'bracelet', 'necklace', 'earring'] as const).map(c => <button id={`store-filter-${c || 'all'}`} key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c ? t(`categories.${c}`) : t('shop.all')}</button>)}
      </div>
      <div className={`storefront__grid ${category || sort !== 'featured' ? 'is-filtered' : ''}`}>
        {listed.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
      <div className="storefront__end"><NavLink id="store-full-catalog" to={path('/shop')}>{id ? 'Lihat seluruh katalog' : 'Explore the full catalog'} ↗</NavLink></div>
    </section>
    <section className="storefront__newsletter" aria-label={t('home.newsletterTitle')}><NewsletterForm source="home" /></section>
  </div>;
}
