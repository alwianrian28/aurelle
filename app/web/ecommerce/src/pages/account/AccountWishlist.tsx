import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlistStore } from '../../store/wishlistStore';
import { useCartStore } from '../../store/cartStore';
import { getAvailableStock } from '../../store/orderStore';
import { products } from '../../mocks/catalog';
import { useCatalogVersion } from '../../lib/catalogSync';
import { useLocalePath, useLocalized, usePrice } from '../../hooks/useLocale';
import type { Product } from '../../types/domain';
import SmartImage from '../../components/SmartImage';
import { ArrowLink } from './parts';

/** F-05 Wishlist (login required). Inactive products are not shown. */
export default function AccountWishlist() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const productIds = useWishlistStore((s) => s.productIds);
  useCatalogVersion(); // re-render when server stock or prices refresh
  const items = productIds.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p && p.active);

  return (
    <>
      <header className="acct-title">
        <div>
          <h2>{t('account.wishlist')}</h2>
          <p>{t('acct.savedPieces', { count: items.length })}</p>
        </div>
        <ArrowLink id="wishlist-browse" to={path('/shop')}>{t('acct.keepBrowsing')}</ArrowLink>
      </header>

      {items.length === 0 ? (
        <div className="acct-card acct-empty">
          <p>{t('account.wishlistEmpty')}</p>
          <NavLink id="wishlist-shop" to={path('/shop')} className="guide-btn guide-btn--outline">{t('account.startShopping')}</NavLink>
        </div>
      ) : (
        <div className="acct-card">
          <ul className="acct-wish">
            {items.map((p) => <WishItem key={p.id} product={p} />)}
          </ul>
        </div>
      )}
    </>
  );
}

function WishItem({ product }: { product: Product }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const text = useLocalized();
  const price = usePrice();
  const toggle = useWishlistStore((s) => s.toggle);
  const add = useCartStore((s) => s.add);
  const [added, setAdded] = useState(false);

  const name = text(product.name);
  const to = path(`/product/${product.slug}`);
  const inStock = product.variants.filter((v) => getAvailableStock(v.id) > 0);
  const minPrice = Math.min(...product.variants.map((v) => v.priceIdr).filter((n) => n > 0));
  // One variant can go straight into the bag; several need a choice on the product page.
  const only = product.variants.length === 1 ? inStock[0] : undefined;

  const addToBag = () => {
    if (!only || !add(product.id, only.id, 1).ok) return;
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  return (
    <li>
      <div className="acct-wish__media">
        <NavLink to={to} tabIndex={-1} aria-hidden="true"><SmartImage src={product.media[0]?.src} alt="" category={product.category} /></NavLink>
        <button id={`wishlist-remove-${product.id}`} type="button" aria-label={t('acct.removeFromWishlist', { name })} onClick={() => toggle(product.id)}>
          {/* The same red heart the shop shows for a saved piece. */}
          <span aria-hidden="true" style={{ backgroundImage: 'url(/media/icons/heart-filled.png)' }} />
        </button>
      </div>
      <NavLink id={`wishlist-item-${product.id}`} className="acct-wish__name" to={to}>{name}</NavLink>
      <span className="acct-wish__price">{price(minPrice)}</span>
      {inStock.length === 0 ? (
        <button type="button" className="guide-btn guide-btn--outline" disabled>{t('common.outOfStock')}</button>
      ) : only ? (
        <button id={`wishlist-add-${product.id}`} type="button" className="guide-btn guide-btn--outline" onClick={addToBag}>
          <span role="status">{t(added ? 'acct.added' : 'acct.addToBag')}</span>
        </button>
      ) : (
        <NavLink id={`wishlist-add-${product.id}`} className="guide-btn guide-btn--outline" to={to}>{t('acct.chooseOptions')}</NavLink>
      )}
    </li>
  );
}
