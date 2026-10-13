import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCollectionBySlug, getProductsByCollection } from '../mocks/catalog';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
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
  const collection = slug ? getCollectionBySlug(slug) : undefined;
  if (!collection) return <NotFound />;

  const products = getProductsByCollection(collection.id);

  return (
    <div>
      <title>{`${localized(collection.name)} — Aurelle`}</title>
      <meta name="description" content={localized(collection.story)} />
      <section className="collection-banner">
        <SmartImage src={collection.banner} category="necklace" alt="" loading="eager" />
        <div className="collection-banner__overlay">
          <div className="container">
            <nav className="collection-banner__crumbs" aria-label="Breadcrumb">
              <NavLink to={path('/collections')}>{t('nav.collections')}</NavLink> / <span>{localized(collection.name)}</span>
            </nav>
            <h1 className="heading-display">{localized(collection.name)}</h1>
            <p>{localized(collection.story)}</p>
          </div>
        </div>
      </section>

      <div className="container section">
        <div className="collection-detail__head">
          <p className="eyebrow">{t('home.collectionPieces', { count: products.length })}</p>
          <NavLink to={path('/shop')} className="home-head__link">{t('home.viewAll')} →</NavLink>
        </div>
        <div className="grid grid-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
