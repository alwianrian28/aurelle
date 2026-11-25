import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale, useLocalePath } from '../hooks/useLocale';
import { products } from '../mocks/catalog';
import ProductCard from '../components/ProductCard';
import StoreService from '../components/StoreService';
import HeroSlider, { type HeroSlide } from '../components/HeroSlider';
import SortMenu from '../components/SortMenu';
import type { Category, I18nText } from '../types/domain';
import './Home.css';

/** Each hero photo carries its own copy; the CTA filters the edit below to that category. */
const HERO_SLIDES: (HeroSlide & { category: Category | ''; title: I18nText; body: I18nText; cta: I18nText })[] = [
  {
    src: '/media/editorial/hero/layered.webp', position: 'center 44%', category: '',
    alt: { id: 'Kalung berlapis dan cincin silver dengan busana putih', en: 'Layered silver necklaces and rings styled with a white blouse' },
    title: { id: 'Kilau tenang, untuk dikenakan.', en: 'Quiet light, made to be worn.' },
    body: { id: 'Cincin, kalung, gelang, dan anting bernuansa silver. Garis yang halus, dibuat untuk menemani setiap hari Anda.', en: 'Rings, necklaces, bracelets and earrings in a silver finish. Fine lines, made to stay with you every day.' },
    cta: { id: 'Jelajahi koleksi', en: 'Explore the collection' },
  },
  {
    src: '/media/editorial/hero/ring.webp', position: 'center 40%', category: 'ring',
    alt: { id: 'Cincin bypass silver di dekat pipi', en: 'Polished silver bypass ring resting by the cheek' },
    title: { id: 'Kilau kecil di ujung jemari.', en: 'A turn of light, close at hand.' },
    body: { id: 'Cincin bypass, solitaire, dan pavé yang dipoles untuk menangkap cahaya di setiap gerakan.', en: 'Bypass, solitaire and pavé bands, polished to catch the light with every gesture.' },
    cta: { id: 'Lihat cincin', en: 'Shop rings' },
  },
  {
    src: '/media/editorial/hero/necklace.webp', position: 'center 45%', category: 'necklace',
    alt: { id: 'Kalung station tujuh berlian di atas kerah putih', en: 'Seven-diamond station necklace over a white collar' },
    title: { id: 'Rantai halus yang mengikuti garis leher.', en: 'Fine chains, drawn along the collarbone.' },
    body: { id: 'Station, liontin, dan kalung berlapis yang cukup ringan untuk dikenakan setiap hari.', en: 'Stations, pendants and layered drops, light enough to wear every day.' },
    cta: { id: 'Lihat kalung', en: 'Shop necklaces' },
  },
  {
    src: '/media/editorial/hero/bracelet.webp', position: 'center 55%', category: 'bracelet',
    alt: { id: 'Gelang bangle pavé silver di pergelangan tangan', en: 'Pavé silver bangle on a relaxed wrist' },
    title: { id: 'Pavé yang mengikuti gerak pergelangan.', en: 'Pavé that moves with the wrist.' },
    body: { id: 'Bangle, cuff, dan gelang tennis dengan kilau tenang dari pagi hingga malam.', en: 'Bangles, cuffs and tennis bracelets with a quiet shine from morning to evening.' },
    cta: { id: 'Lihat gelang', en: 'Shop bracelets' },
  },
  {
    src: '/media/editorial/hero/earring.webp', position: '70% 40%', category: 'earring',
    alt: { id: 'Anting bunga silver dari samping', en: 'Delicate silver flower earring in profile' },
    title: { id: 'Cahaya kecil yang membingkai wajah.', en: 'Light, framed at the ear.' },
    body: { id: 'Stud, hoop, dan climber berukuran mungil, setiap batunya dipilih dengan cermat.', en: 'Studs, hoops and climbers, petite in scale and considered in every stone.' },
    cta: { id: 'Lihat anting', en: 'Shop earrings' },
  },
];

/** Display order for both the tabs and the grouped default view. */
const STORE_CATEGORIES: Category[] = ['necklace', 'earring', 'ring', 'bracelet'];
const storeGroups = STORE_CATEGORIES.map(c => ({ category: c, items: products.filter(p => p.active && p.category === c) }));
const storeCollection = storeGroups.flatMap(group => group.items);
type SortKey = 'featured' | 'low' | 'high';

/** Static editorial storefront; cinematic 3D is isolated on the entrance route. */
export default function Home() {
  const id = useLocale() === 'id';
  const path = useLocalePath();
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category | ''>('');
  const [sort, setSort] = useState<SortKey>('featured');
  const listed = useMemo(() => {
    const list = storeCollection.filter(p => !category || p.category === category);
    const price = (p: typeof products[number]) => Math.min(...p.variants.map(v => v.priceIdr).filter(n => n > 0), Infinity);
    if (sort === 'low') list.sort((a, b) => price(a) - price(b));
    if (sort === 'high') list.sort((a, b) => price(b) - price(a));
    return list;
  }, [category, sort]);
  return <div className="storefront"><div className="container">
    <title>Aurelle | Silver Luxury Jewelry</title>
    <meta name="description" content={id ? 'Jelajahi koleksi Aurelle: cincin, gelang, kalung dan anting dengan tampilan silver.' : 'Explore Aurelle rings, bracelets, necklaces and earrings in a refined silver aesthetic.'} />
    <section className="storefront__hero" aria-labelledby="store-title">
      <HeroSlider slides={HERO_SLIDES} locale={id ? 'id' : 'en'}>
        {index => {
          const slide = HERO_SLIDES[index];
          const text = (value: I18nText) => (id ? value.id : value.en);
          return <div className="storefront__hero-copy" key={index}>
            <h1 id="store-title">{text(slide.title)}</h1>
            <p>{text(slide.body)}</p>
            <a id="store-explore" className="storefront__hero-cta" href="#store-collection" onClick={() => setCategory(slide.category)}>{text(slide.cta)}</a>
          </div>;
        }}
      </HeroSlider>
    </section>
    <div className="storefront__benefits" aria-label={id ? 'Layanan Aurelle' : 'Aurelle services'}>
      <span>{id ? 'Koleksi berpenampilan silver' : 'Silver-look collections'}</span>
      <span>{id ? 'Pilihan ready stock' : 'Ready-stock selection'}</span>
      <span>IDR / USD </span>
    </div>
    <section id="store-collection" aria-label={t('nav.shop')}>
      <div className="storefront__toolbar">
        <div className="storefront__tabs" role="group" aria-label={t('shop.category')}>
          {(['', ...STORE_CATEGORIES] as const).map(c => <button type="button" id={`store-filter-${c || 'all'}`} key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c ? t(`categories.${c}`) : t('shop.all')}</button>)}
        </div>
        <SortMenu<SortKey>
          id="store-sort"
          label={id ? 'Urutkan' : 'Sort'}
          value={sort}
          onChange={setSort}
          options={[
            { value: 'featured', label: id ? 'Pilihan kami' : 'Featured' },
            { value: 'low', label: id ? 'Harga terendah' : 'Price, low to high' },
            { value: 'high', label: id ? 'Harga tertinggi' : 'Price, high to low' },
          ]}
        />
        <span className="visually-hidden" role="status">{id ? `${listed.length} produk` : `${listed.length} pieces`}</span>
      </div>
      {/* Default view (All + Featured) is grouped by category; any filter or sort shows one grid. */}
      {!category && sort === 'featured'
        ? storeGroups.map(group => <section key={group.category} className="storefront__group" aria-labelledby={`store-group-${group.category}`}>
            <h2 id={`store-group-${group.category}`} className="storefront__group-title">{t(`categories.${group.category}`)}</h2>
            <div className="storefront__grid">
              {group.items.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>)
        : <div className="storefront__grid is-filtered">
            {listed.map(product => <ProductCard key={product.id} product={product} />)}
          </div>}
      <div className="storefront__end"><NavLink id="store-full-catalog" to={path('/shop')}>{id ? 'Lihat seluruh katalog' : 'Explore the full catalog'}</NavLink></div>
    </section>
    <StoreService />
  </div></div>;
}
