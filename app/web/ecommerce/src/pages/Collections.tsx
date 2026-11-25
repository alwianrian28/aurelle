import type { MouseEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collections, getProductsByCollection } from '../mocks/catalog';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
import { useCatalogVersion } from '../lib/catalogSync';
import { ScrollSmoother } from '../lib/gsap';
import SmartImage from '../components/SmartImage';
import ProductCard from '../components/ProductCard';
import ChatLink from '../components/ChatLink';
import './Collections.css';

const PREVIEW = 4;

/**
 * F-04 Collections index: one band per collection (story, facts, first pieces), alternating
 * light and dark, with jump links on top and a catalog prompt at the end.
 */
export default function Collections() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  useCatalogVersion(); // re-render when server stock or prices refresh

  // The page scrolls through ScrollSmoother, so in-page jumps go through it when it is active.
  const jumpTo = (e: MouseEvent, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const smoother = ScrollSmoother.get();
    if (smoother) smoother.scrollTo(target, true, 'top 90px');
    else target.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="collections">
      <title>{`${t('nav.collections')} | Aurelle`}</title>
      <meta name="description" content={t('collectionsPage.intro')} />

      <header className="container collections__head">
        <div className="collections__intro">
          <h1>{t('collectionsPage.title')}</h1>
          <p>{t('collectionsPage.intro')}</p>
        </div>
        {collections.length > 1 && (
          <nav className="collections__jump" aria-label={t('collectionsPage.jump')}>
            {collections.map((c) => (
              <a key={c.id} href={`#collection-${c.slug}`} onClick={(e) => jumpTo(e, `collection-${c.slug}`)}>{localized(c.name)}</a>
            ))}
          </nav>
        )}
      </header>

      {collections.map((c, i) => {
        const items = getProductsByCollection(c.id);
        const name = localized(c.name);
        const href = path(`/collections/${c.slug}`);
        const categories = [...new Set(items.map((p) => p.category))].map((category) => t(`categories.${category}`)).join(', ');
        const dark = i % 2 === 1;
        return (
          <section key={c.id} id={`collection-${c.slug}`} className={`collections-band${dark ? ' collections-band--dark' : ''}`} aria-labelledby={`collection-${c.slug}-title`}>
            <div className="container">
              <div className="collections-feature">
                <NavLink to={href} className="collections-feature__media" tabIndex={-1} aria-hidden="true">
                  <SmartImage src={c.banner} category="ring" alt="" loading={i === 0 ? 'eager' : 'lazy'} />
                </NavLink>
                <div className="collections-feature__body">
                  <p className="collections-feature__eyebrow">{t('collectionsPage.number', { n: String(i + 1).padStart(2, '0') })}</p>
                  <h2 id={`collection-${c.slug}-title`}>{name}</h2>
                  <p className="collections-feature__story">{localized(c.story)}</p>
                  <dl className="collections-feature__facts">
                    <div><dt>{t('collectionsPage.piecesLabel')}</dt><dd>{items.length}</dd></div>
                    {categories && <div><dt>{t('collectionsPage.categoriesLabel')}</dt><dd>{categories}</dd></div>}
                  </dl>
                  <NavLink id={`collection-${c.slug}-open`} to={href} className="guide-btn collections-feature__cta">{t('collectionsPage.discover', { name })}</NavLink>
                </div>
              </div>

              {items.length > 0 && (
                <div className="collections-pieces">
                  <div className="collections-pieces__head">
                    <h3>{t('collectionsPage.piecesIn')}</h3>
                    <NavLink id={`collection-${c.slug}-all`} to={href}>{t('collectionsPage.viewAll', { count: items.length })} <span aria-hidden="true">→</span></NavLink>
                  </div>
                  <div className="grid grid-4">
                    {items.slice(0, PREVIEW).map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}

      <section className="container collections-cta" aria-labelledby="collections-cta-title">
        <h2 id="collections-cta-title">{t('collectionsPage.ctaTitle')}</h2>
        <p>{t('collectionsPage.ctaBody')}</p>
        <div className="collections-cta__actions">
          <NavLink id="collections-cta-shop" to={path('/shop')} className="guide-btn">{t('collectionsPage.ctaShop')}</NavLink>
          <ChatLink id="collections-cta-chat" className="guide-btn guide-btn--outline" message={{ id: t('collectionsPage.chatMessage'), en: t('collectionsPage.chatMessage') }}>{t('collectionsPage.ctaChat')}</ChatLink>
        </div>
      </section>
    </div>
  );
}
