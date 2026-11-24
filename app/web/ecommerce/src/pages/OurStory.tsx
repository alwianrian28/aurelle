import type { MouseEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { products } from '../mocks/catalog';
import { useLocalePath } from '../hooks/useLocale';
import { useGuideStore } from '../store/guideStore';
import { ScrollSmoother } from '../lib/gsap';
import SmartImage from '../components/SmartImage';
import type { Category } from '../types/domain';
import './OurStory.css';

/** Product photos stand in for brand photography; each is looked up by product id. */
function Photo({ productId, eager }: { productId: string; eager?: boolean }) {
  const product = products.find((p) => p.id === productId);
  const category: Category = product?.category ?? 'ring';
  return <SmartImage src={product?.media[0]?.src} category={category} alt="" loading={eager ? 'eager' : 'lazy'} />;
}

const FACTS = ['metal', 'daily', 'finish', 'certified'] as const;
const STEPS = [
  { key: 'design', productId: 'cincin-oval' },
  { key: 'craft', productId: 'gelang-tennis' },
  { key: 'finish', productId: 'gelang-charm-hati' },
] as const;

/**
 * F-19 Our Story. FR-19-02: brand claims must come from approved brand material, and the PRD
 * (§8.1) treats "silver" as the look of the metal, not a verified material. Facts that are
 * not confirmed yet stay as bracketed placeholders in the copy (`story.*` in the locale files).
 */
export default function OurStory() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const openCare = useGuideStore((s) => s.openCare);

  // The page scrolls through ScrollSmoother, so the in-page jump goes through it when it is active.
  const jumpToMaterial = (e: MouseEvent) => {
    const target = document.getElementById('story-material');
    if (!target) return;
    e.preventDefault();
    const smoother = ScrollSmoother.get();
    if (smoother) smoother.scrollTo(target, true, 'top 76px');
    else target.scrollIntoView({ block: 'start' });
  };

  return (
    <article className="story">
      <title>{`${t('nav.ourStory')} — Aurelle`}</title>
      <meta name="description" content={t('story.heroBody')} />

      <header className="story__band story-hero">
        <div className="container story__inner story-hero__grid">
          <div className="story-hero__copy">
            <p className="story__eyebrow">{t('nav.ourStory')}</p>
            <h1>{t('story.heroTitle')} <em>{t('story.heroTitleAccent')}</em></h1>
            <p className="story-hero__body">{t('story.heroBody')}</p>
            <div className="story__actions">
              <NavLink id="story-shop" to={path('/shop')} className="guide-btn">{t('story.heroShop')}</NavLink>
              <a id="story-about-material" href="#story-material" className="guide-btn guide-btn--outline" onClick={jumpToMaterial}>{t('story.heroMaterial')}</a>
            </div>
          </div>
          <div className="story-hero__media"><Photo productId="kalung-berlapis" eager /></div>
        </div>
      </header>

      <section className="story__band story-began" aria-labelledby="story-began-title">
        <div className="container story__inner story-began__grid">
          <div>
            <p className="story__eyebrow">{t('story.beganEyebrow')}</p>
            <h2 id="story-began-title">{t('story.beganTitle')}</h2>
          </div>
          <div className="story-began__text">
            <p>{t('story.beganOne')}</p>
            <p>{t('story.beganTwo')}</p>
            <figure>
              <blockquote>{t('story.founderQuote')}</blockquote>
              <figcaption>{t('story.founderName')}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="story-material" className="story__band story-material" aria-labelledby="story-material-title">
        <div className="container story__inner story-material__grid">
          <div className="story-material__media"><Photo productId="gelang" /></div>
          <div className="story-material__copy">
            <p className="story__eyebrow">{t('story.materialEyebrow')}</p>
            <h2 id="story-material-title">{t('story.materialTitle')}</h2>
            <p className="story-material__body">{t('story.materialBody')}</p>
            <dl className="story-material__facts">
              {FACTS.map((fact) => (
                <div key={fact}>
                  <dt>{t(`story.facts.${fact}.title`)}</dt>
                  <dd>{t(`story.facts.${fact}.body`)}</dd>
                </div>
              ))}
            </dl>
            <button id="story-care" type="button" className="story__text-link" onClick={openCare}>{t('story.careLink')}</button>
          </div>
        </div>
      </section>

      <section className="story__band story-made" aria-labelledby="story-made-title">
        <div className="container story__inner">
          <div className="story-made__head">
            <div>
              <p className="story__eyebrow">{t('story.madeEyebrow')}</p>
              <h2 id="story-made-title">{t('story.madeTitle')}</h2>
            </div>
            <p>{t('story.madeNote')}</p>
          </div>
          <ol className="story-made__steps">
            {STEPS.map((step) => (
              <li key={step.key}>
                <div className="story-made__media"><Photo productId={step.productId} /></div>
                <h3>{t(`story.steps.${step.key}.title`)}</h3>
                <p>{t(`story.steps.${step.key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="story__band story-cta" aria-labelledby="story-cta-title">
        <div className="container story__inner story-cta__grid">
          <div className="story-cta__media"><Photo productId="cincin-susun" /></div>
          <div>
            <h2 id="story-cta-title">{t('story.ctaTitle')}</h2>
            <p>{t('story.ctaBody')}</p>
            <div className="story__actions">
              <NavLink id="story-cta-shop" to={path('/shop')} className="guide-btn">{t('story.ctaShop')}</NavLink>
              <NavLink id="story-cta-collections" to={path('/collections')} className="guide-btn guide-btn--outline">{t('story.ctaCollections')}</NavLink>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
