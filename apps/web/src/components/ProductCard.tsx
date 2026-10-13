import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types/domain';
import { useLocalePath, useLocalized, usePrice } from '../hooks/useLocale';
import { useWishlistStore } from '../store/wishlistStore';
import { useAuthStore } from '../store/authStore';
import { getAvailableStock, useOrderStore } from '../store/orderStore';
import SmartImage from './SmartImage';
import './ProductCard.css';

export default function ProductCard({ product }: { product: Product }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  const price = usePrice();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { has, toggle } = useWishlistStore();
  const isWished = has(product.id);

  useOrderStore((s) => s.orders); // re-render saat reservasi berubah
  const minPrice = Math.min(...product.variants.map((v) => v.priceIdr).filter((p) => p > 0));
  const soldOut = product.saleType === 'ready_stock' && product.variants.every((v) => getAvailableStock(v.id) <= 0);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      // FR-05-02: wishlist wajib login; kembali ke halaman asal setelah login (FR-01-08)
      navigate(path('/auth/login'), { state: { from: location.pathname } });
      return;
    }
    toggle(product.id);
  };

  return (
    <NavLink to={path(`/product/${product.slug}`)} className="product-card">
      <div className="product-card__media">
        <SmartImage src={product.media[0]?.src} alt={localized(product.media[0]?.alt)} category={product.category} />
        {product.featured && <span className="pill pill--silver product-card__badge">3D</span>}
        {soldOut && <span className="pill product-card__badge product-card__badge--stock">{t('common.outOfStock')}</span>}
        <button
          className={`product-card__wish ${isWished ? 'is-active' : ''}`}
          onClick={handleWishlist}
          aria-label={t('common.wishlist')}
          aria-pressed={isWished}
        >
          <HeartIcon filled={isWished} />
        </button>
      </div>
      <div className="product-card__body">
        <p className="product-card__category text-muted text-sm">{t(`categories.${product.category}`)}</p>
        <h3 className="product-card__name">{localized(product.name)}</h3>
        <p className="product-card__price">
          {product.saleType === 'po' ? t('common.requestPo') : price(minPrice)}
        </p>
      </div>
    </NavLink>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="M12 20s-7-4.35-9.5-8.5C.9 8.1 2.4 5 5.6 5c2 0 3.2 1.1 4 2.3C10.4 6.1 11.6 5 13.6 5c3.2 0 4.7 3.1 3.1 6.5C19 15.65 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
