import { useState } from 'react';
import { useParams, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProductBySlug } from '../mocks/catalog';
import { useLocalePath, useLocalized, usePrice } from '../hooks/useLocale';
import { useCartStore } from '../store/cartStore';
import { useWishlistStore } from '../store/wishlistStore';
import { useAuthStore } from '../store/authStore';
import { getAvailableStock, useOrderStore } from '../store/orderStore';
import { LazyJewelViewer } from '../components/three/Lazy3D';
import SmartImage from '../components/SmartImage';
import NotFound from './NotFound';
import './ProductDetail.css';

/**
 * F-04 — Detail Produk.
 * CTA menyesuaikan tipe penjualan (FR-04-08): ready stock → Tambah ke Keranjang;
 * PO → Ajukan PO (membuka form pengajuan dengan referensi produk, AC-04-06).
 * Komponen di-remount per slug (key) agar varian/qty/media kembali ke awal saat pindah produk.
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
  const { has, toggle } = useWishlistStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  // Re-render saat order berubah agar stok tersedia (reservasi) selalu terbaru.
  useOrderStore((s) => s.orders);

  const product = slug ? getProductBySlug(slug) : undefined;
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState(product?.featured ? -1 : 0);

  if (!product || !product.active) return <NotFound />;

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const isReadyStock = product.saleType === 'ready_stock';
  const available = getAvailableStock(variant.id);
  const isOutOfStock = isReadyStock && available <= 0;

  const handleAddToCart = () => {
    const result = add(product.id, variant.id, qty);
    setFeedback(result.ok ? 'added' : result.reason ?? 'error');
  };

  return (
    <div className="container section product-detail">
      <div className="product-detail__gallery">
        {product.featured && activeMedia === -1 ? (
          <LazyJewelViewer shape={product.model3d ?? 'ring'} posterSrc={product.media[0]?.src} posterAlt={localized(product.media[0]?.alt)} />
        ) : (
          <div className="product-detail__media-main">
            <SmartImage
              src={product.media[activeMedia]?.src}
              alt={localized(product.media[activeMedia]?.alt)}
              category={product.category}
              loading="eager"
            />
          </div>
        )}
        {(product.media.length > 1 || product.featured) && (
          <div className="product-detail__thumbs">
            {product.featured && (
              <button
                id="pdp-thumb-3d"
                className={`product-detail__thumb-3d ${activeMedia === -1 ? 'is-active' : ''}`}
                onClick={() => setActiveMedia(-1)}
                aria-label={t('product.view3d')}
              >
                3D
              </button>
            )}
            {product.media.map((m, i) => (
              <button
                key={m.id}
                className={i === activeMedia ? 'is-active' : ''}
                onClick={() => setActiveMedia(i)}
                aria-label={`Media ${i + 1}`}
              >
                <SmartImage src={m.src} alt={localized(m.alt)} category={product.category} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="product-detail__info">
        <p className="eyebrow">{t(`categories.${product.category}`)}</p>
        <h1 className="heading-xl">{localized(product.name)}</h1>
        <p className="text-muted" style={{ marginTop: 'var(--space-2)' }}>{localized(product.tagline)}</p>

        <div className="product-detail__price">
          {isReadyStock ? price(variant.priceIdr) : t('common.requestPo')}
        </div>

        <p className="product-detail__desc">{localized(product.description)}</p>

        <dl className="product-detail__specs">
          <div>
            <dt>{t('product.materials')}</dt>
            <dd>{localized(product.materials)}</dd>
          </div>
          {product.stoneType && (
            <div>
              <dt>{t('product.stone')}</dt>
              <dd>{localized(product.stoneType)}</dd>
            </div>
          )}
          <div>
            <dt>{t('product.engraving')}</dt>
            <dd>{product.engravingAvailable ? t('product.available') : t('product.notAvailable')}</dd>
          </div>
        </dl>

        {product.variants.length > 1 && (
          <div className="product-detail__variants">
            <label>{t('product.selectVariant')}</label>
            <div className="product-detail__variant-list">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  className={v.id === variantId ? 'is-active' : ''}
                  disabled={isReadyStock && getAvailableStock(v.id) <= 0}
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                    setFeedback(null);
                  }}
                >
                  {localized(v.label)}
                </button>
              ))}
            </div>
          </div>
        )}

        {isReadyStock ? (
          <>
            <div className="product-detail__qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t('product.decreaseQty')}>
                −
              </button>
              <span>{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(Math.max(1, available), q + 1))}
                aria-label={t('product.increaseQty')}
                disabled={qty >= available}
              >
                +
              </button>
            </div>

            <div className="product-detail__actions">
              <button className="btn btn--primary btn--block" disabled={isOutOfStock} onClick={handleAddToCart}>
                {isOutOfStock ? t('common.outOfStock') : t('common.addToCart')}
              </button>
              <button
                className={`btn btn--outline ${has(product.id) ? 'is-active' : ''}`}
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate(path('/auth/login'), { state: { from: location.pathname } });
                    return;
                  }
                  toggle(product.id);
                }}
                aria-label={t('common.wishlist')}
                aria-pressed={has(product.id)}
              >
                {has(product.id) ? '♥' : '♡'}
              </button>
            </div>
            {feedback === 'added' && (
              <p className="product-detail__feedback is-ok" role="status">
                {t('product.addedToCart')} <NavLink to={path('/cart')}>{t('product.viewCart')} →</NavLink>
              </p>
            )}
            {feedback === 'exceeds_stock' && (
              <p className="product-detail__feedback is-error" role="alert">
                {t('product.exceedsStock', { count: available })}
              </p>
            )}
            {feedback === 'out_of_stock' && (
              <p className="product-detail__feedback is-error" role="alert">
                {t('product.outOfStockMsg')}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="product-detail__po-note">
              {localized(product.poEstimate)
                ? t('product.poNoteWithEstimate', { estimate: localized(product.poEstimate) })
                : t('product.poNote')}
            </p>
            <div className="product-detail__actions">
              <NavLink to={`${path('/custom-po')}?ref=${product.slug}`} className="btn btn--silver btn--block">
                {t('common.requestPo')}
              </NavLink>
            </div>
          </>
        )}

        <NavLink to={`${path('/custom-po')}?ref=${product.slug}`} className="product-detail__consult">
          {t('common.consultCustom')} →
        </NavLink>
      </div>
    </div>
  );
}
