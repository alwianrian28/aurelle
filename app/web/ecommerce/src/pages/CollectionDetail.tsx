import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collections, getCollectionBySlug, getProductsByCollection } from '../mocks/catalog';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
import { useCatalogVersion } from '../lib/catalogSync';
import ProductCard from '../components/ProductCard';
import SmartImage from '../components/SmartImage';
import NotFound from './NotFound';
import './Collections.css';

/** FR-04-09: detail koleksi menampilkan cerita bilingual, banner, dan produk sesuai urutan admin. */
export default function CollectionDetail() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  useCatalogVersion(); // re-render when server stock or prices refresh
  const collection = slug ? getCollectionBySlug(slug) : undefined;
  if (!collection) return <NotFound />;

  const products = getProductsByCollection(collection.id);
  const name = localized(collection.name);
  const number = String(collections.indexOf(collection) + 1).padStart(2, '0');
  const categories = [...new Set(products.map((p) => p.category))].map((category) => t(`categories.${category}`)).join(', ');

  return (
    <div className="collections collection-detail">
      <title>{`${name} | Aurelle`}</title>
      <meta name="description" content={localized(collection.story)} />
      <div className="container">
        <NavLink id="collection-back" to={path('/collections')} className="collection-detail__back">
          <span aria-hidden="true">←</span> <span>{t('collectionsPage.back')}</span>
        </NavLink>

        <header className="collections-feature">
          <div className="collections-feature__media">
            <SmartImage src={collection.banner} category="ring" alt="" loading="eager" />
          </div>
          <div className="collections-feature__body">
            <p className="collections-feature__eyebrow">{t('collectionsPage.number', { n: number })}</p>
            <h1>{name}</h1>
            <p className="collections-feature__story">{localized(collection.story)}</p>
            <dl className="collections-feature__facts">
              <div><dt>{t('collectionsPage.piecesLabel')}</dt><dd>{products.length}</dd></div>
              {categories && <div><dt>{t('collectionsPage.categoriesLabel')}</dt><dd>{categories}</dd></div>}
            </dl>
          </div>
        </header>

        <section className="collections-pieces" aria-labelledby="collection-pieces-title">
          <div className="collections-pieces__head">
            <h2 id="collection-pieces-title">{t('collectionsPage.piecesIn')}</h2>
            <NavLink id="collection-shop-all" to={path('/shop')}>{t('collectionsPage.ctaShop')} <span aria-hidden="true">→</span></NavLink>
          </div>
          <div className="grid grid-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
