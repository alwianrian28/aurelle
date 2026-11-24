import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collections, getProductsByCollection } from '../mocks/catalog';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
import SmartImage from '../components/SmartImage';
import './Collections.css';

/** F-04 Collections index — banner koleksi + cuplikan produk. */
export default function Collections() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();

  return (
    <div className="container section">
      <title>{`${t('nav.collections')} — Aurelle`}</title>
      <meta name="description" content={t('collectionsPage.intro')} />
      <header className="collections-hero">
        <p className="eyebrow">{t('nav.collections')}</p>
        <h1 className="heading-xl">{t('collectionsPage.title')}</h1>
        <p className="text-muted">{t('collectionsPage.intro')}</p>
      </header>

      <div className="collections-list">
        {collections.map((c, i) => {
          const items = getProductsByCollection(c.id);
          return (
            <article key={c.id} className={`collections-item ${i % 2 ? 'is-reverse' : ''}`}>
              <NavLink to={path(`/collections/${c.slug}`)} className="collections-item__banner" aria-label={localized(c.name)}>
                <SmartImage src={c.banner} category="necklace" alt="" />
              </NavLink>
              <div className="collections-item__body">
                <span className="eyebrow">{String(i + 1).padStart(2, '0')} · {t('home.collectionPieces', { count: items.length })}</span>
                <h2 className="heading-xl">{localized(c.name)}</h2>
                <p className="text-muted">{localized(c.story)}</p>
                <ul className="collections-item__thumbs">
                  {items.slice(0, 3).map((p) => (
                    <li key={p.id}>
                      <NavLink to={path(`/product/${p.slug}`)} title={localized(p.name)}>
                        <SmartImage src={p.media[0]?.src} category={p.category} alt={localized(p.name)} />
                      </NavLink>
                    </li>
                  ))}
                </ul>
                <NavLink id={`collection-${c.slug}`} to={path(`/collections/${c.slug}`)} className="btn btn--outline">
                  {t('collectionsPage.explore')}
                </NavLink>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
