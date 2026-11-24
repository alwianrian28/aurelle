import { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProductBySlug, products, shippingServices } from '../mocks/catalog';
import { careGuide } from '../content/service';
import { useLocalePath, useLocalized, usePrice } from '../hooks/useLocale';
import { useCartStore } from '../store/cartStore';
import { useGuideStore } from '../store/guideStore';
import { getAvailableStock } from '../store/orderStore';
import { useCatalogVersion } from '../lib/catalogSync';
import ChatLink from '../components/ChatLink';
import ProductCard from '../components/ProductCard';
import Icon from '../components/ServiceIcons';
import SmartImage from '../components/SmartImage';
import WishlistButton from '../components/WishlistButton';
import type { Product } from '../types/domain';
import NotFound from './NotFound';
import './ProductDetail.css';

const PAIRS_COUNT = 4;

/**
 * Up to four other pieces to wear with this one, taken in turn from the other categories
 * (a necklace pairs with earrings, a ring and a bracelet, not four more necklaces). The
 * start point follows the product, so each page suggests a different set.
 */
function pairsFor(product: Product): Product[] {
  const start = Math.max(0, products.findIndex((p) => p.id === product.id));
  const others = products.filter((p) => p.active && p.category !== product.category);
  const byCategory = [...new Set(others.map((p) => p.category))].map((category) => {
    const list = others.filter((p) => p.category === category);
    return list.map((_, i) => list[(i + start) % list.length]);
  });
  const picks: Product[] = [];
  for (let round = 0; picks.length < PAIRS_COUNT && byCategory.some((list) => list[round]); round++) {
    for (const list of byCategory) if (list[round] && picks.length < PAIRS_COUNT) picks.push(list[round]);
  }
  return picks;
}

/**
 * F-04 product detail: gallery with a Photos / 3D toggle, purchase panel, and the detail,
 * care and shipping sections. Remounted per slug (key) so variant, quantity and media reset
 * when moving between products.
 */
export default function ProductDetailRoute() {
  const { slug } = useParams();
  return <ProductDetail key={slug} slug={slug} />;
}

function ProductDetail({ slug }: { slug?: string }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  const price = usePrice();
  const { add } = useCartStore();
  const openCare = useGuideStore((s) => s.openCare);
  // Re-render when the catalog refreshes so available stock stays current.
  useCatalogVersion();

  const product = slug ? getProductBySlug(slug) : undefined;
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState(0);
  const [view, setView] = useState<'photos' | '3d'>('photos');

  if (!product || !product.active) return <NotFound />;

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const available = getAvailableStock(variant.id);
  const isOutOfStock = available <= 0;
  const name = localized(product.name);
  const media = product.media[activeMedia];
  const pairs = pairsFor(product);

  const handleAddToCart = () => {
    const result = add(product.id, variant.id, qty);
    setFeedback(result.ok ? 'added' : result.reason ?? 'error');
  };

  return (
    <div className="pdp">
      <div className="container">
      <title>{`${name} — Aurelle`}</title>

      <div className="pdp__main">
        <div className={`pdp__gallery${product.media.length > 1 ? '' : ' pdp__gallery--single'}`}>
          {product.media.length > 1 && (
            <div className="pdp__thumbs">
              {product.media.map((m, i) => (
                <button
                  key={m.id}
                  id={`pdp-photo-${i + 1}`}
                  type="button"
                  aria-pressed={view === 'photos' && i === activeMedia}
                  aria-label={t('product.showPhoto', { n: i + 1 })}
                  onClick={() => { setActiveMedia(i); setView('photos'); }}
                >
                  <SmartImage src={m.src} alt="" category={product.category} />
                </button>
              ))}
            </div>
          )}

          <div className="pdp__stage">
            <div className="pdp__stage-bar">
              {product.jewelryModel ? (
                <div className="pdp__toggle" role="group" aria-label={name}>
                  <button id="pdp-view-photos" type="button" aria-pressed={view === 'photos'} onClick={() => setView('photos')}>{t('product.photos')}</button>
                  <button id="pdp-view-3d" type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}><CubeIcon />{t('product.view3d')}</button>
                </div>
              ) : <span />}
              {view === 'photos' && product.media.length > 1 && <span className="pdp__count">{t('product.photoCount', { current: activeMedia + 1, total: product.media.length })}</span>}
            </div>
            <div className="pdp__frame">
              {/* The 3D viewer (iframe + WebGL) exists only while its tab is selected. */}
              {view === '3d' && product.jewelryModel
                ? <iframe src={`/jewelry-3d/index.html?embed=1&model=${encodeURIComponent(product.jewelryModel)}`} title={`${name} — 3D`} />
                : <SmartImage key={media?.id} src={media?.src} alt={localized(media?.alt)} category={product.category} loading="eager" />}
            </div>
          </div>
        </div>

        <div className="pdp__info">
          <p className="pdp__eyebrow">{t(`categories.${product.category}`)}</p>
          <h1 className="pdp__title">{name}</h1>
          <p className="pdp__tagline">{localized(product.tagline)}</p>
          <p className="pdp__price">{price(variant.priceIdr)}</p>
          <p className="pdp__desc">{localized(product.description)}</p>

          {product.variants.length > 1 && (
            <fieldset className="pdp__variants">
              <legend>{t('product.selectVariant')}</legend>
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === variant.id}
                  disabled={getAvailableStock(v.id) <= 0}
                  onClick={() => { setVariantId(v.id); setQty(1); setFeedback(null); }}
                >
                  {localized(v.label)}
                </button>
              ))}
            </fieldset>
          )}

          <div className="pdp__buy">
            <div className="pdp__qty" role="group" aria-label={t('product.quantity')}>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t('product.decreaseQty')} disabled={qty <= 1}>−</button>
              <span aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(Math.max(1, available), q + 1))} aria-label={t('product.increaseQty')} disabled={qty >= available}>+</button>
            </div>
            <button id="pdp-add" type="button" className="pdp__add" disabled={isOutOfStock} onClick={handleAddToCart}>
              {isOutOfStock ? t('common.outOfStock') : t('common.addToCart')}
            </button>
            <WishlistButton productId={product.id} className="pdp__wish" size={18} />
          </div>
          {feedback === 'added' && <p className="pdp__feedback is-ok" role="status">{t('product.addedToCart')} <NavLink to={path('/cart')}>{t('product.viewCart')} →</NavLink></p>}
          {feedback === 'exceeds_stock' && <p className="pdp__feedback is-error" role="alert">{t('product.exceedsStock', { count: available })}</p>}
          {feedback === 'out_of_stock' && <p className="pdp__feedback is-error" role="alert">{t('product.outOfStockMsg')}</p>}

          <ul className="pdp__service">
            <li><Icon name="delivery" size={20} />{t('product.serviceDelivery')}</li>
            <li><Icon name="authentic" size={20} />{t('product.serviceCertificate')}</li>
            <li><Icon name="returns" size={20} /><NavLink id="pdp-returns" to={path('/policies/revision-return')}>{t('product.serviceReturns')}</NavLink></li>
          </ul>

          <div className="pdp__sections">
            <details name="pdp-section" open>
              <summary>{t('product.details')}</summary>
              <dl className="pdp__specs">
                <div><dt>{t('product.materials')}</dt><dd>{localized(product.materials)}</dd></div>
                {product.stoneType && <div><dt>{t('product.stone')}</dt><dd>{localized(product.stoneType)}</dd></div>}
                <div><dt>{t('product.engraving')}</dt><dd>{product.engravingAvailable ? t('product.available') : t('product.notAvailable')}</dd></div>
              </dl>
            </details>
            <details name="pdp-section">
              <summary>{t('product.care')}</summary>
              <ul className="pdp__list">
                {careGuide.groups.map((group) => <li key={group.icon}>{localized(group.tips[0])}</li>)}
              </ul>
              <button id="pdp-open-care" type="button" className="pdp__text-link" onClick={openCare}>{t('product.careMore')}</button>
            </details>
            <details name="pdp-section">
              <summary>{t('product.shippingReturns')}</summary>
              <dl className="pdp__specs">
                {shippingServices.map((s) => <div key={s.id}><dt>{s.courier} · {localized(s.name)}</dt><dd>{t('product.shippingEta', { days: s.etaDays })}</dd></div>)}
              </dl>
              <p className="pdp__links">
                <NavLink id="pdp-shipping-policy" className="pdp__text-link" to={path('/policies/shipping')}>{t('product.shippingPolicy')}</NavLink>
                <NavLink id="pdp-returns-policy" className="pdp__text-link" to={path('/policies/revision-return')}>{t('product.returnsPolicy')}</NavLink>
              </p>
            </details>
          </div>

          <p className="pdp__chat">
            <Icon name="whatsapp" size={18} />
            <span>{t('product.question')} <ChatLink id="pdp-chat" className="pdp__text-link" message={{ id: t('product.chatMessage', { name }), en: t('product.chatMessage', { name }) }}>{t('product.chat')}</ChatLink></span>
          </p>
        </div>
      </div>

      {pairs.length > 0 && (
        <section className="pdp__pairs" aria-labelledby="pdp-pairs-title">
          <div className="pdp__pairs-head">
            <h2 id="pdp-pairs-title">{t('product.pairsWith')}</h2>
            <NavLink id="pdp-pairs-all" to={path('/shop')}>{t('product.viewAll')}</NavLink>
          </div>
          <div className="grid grid-4">
            {pairs.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

function CubeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}
