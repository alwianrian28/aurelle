import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types/domain';
import { useLocalePath, useLocalized, usePrice } from '../hooks/useLocale';
import { getAvailableStock } from '../store/orderStore';
import { useCatalogVersion } from '../lib/catalogSync';
import SmartImage from './SmartImage';
import WishlistButton from './WishlistButton';
import './ProductCard.css';

export default function ProductCard({ product }: { product: Product }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  const price = usePrice();

  useCatalogVersion(); // re-render when server stock or prices refresh
  const minPrice = Math.min(...product.variants.map((v) => v.priceIdr).filter((p) => p > 0));
  const soldOut = product.variants.every((v) => getAvailableStock(v.id) <= 0);

  return (
    <NavLink to={path(`/product/${product.slug}`)} className="product-card">
      <div className={`product-card__media${product.id === 'anting-bunga' ? ' product-card__media--mirrored' : ''}`}>
        <SmartImage src={product.media[0]?.src} alt={localized(product.media[0]?.alt)} category={product.category} />
        {soldOut && <span className="pill product-card__badge product-card__badge--stock">{t('common.outOfStock')}</span>}
        <WishlistButton productId={product.id} className="product-card__wish" />
      </div>
      <div className="product-card__body">
        <p className="product-card__category text-muted text-sm">{t(`categories.${product.category}`)}</p>
        <h3 className="product-card__name">{localized(product.name)}</h3>
        <p className="product-card__price">
          {price(minPrice)}
        </p>
      </div>
    </NavLink>
  );
}
