import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlistStore } from '../../store/wishlistStore';
import { products } from '../../mocks/catalog';
import { useLocalePath } from '../../hooks/useLocale';
import ProductCard from '../../components/ProductCard';

/** F-05 Wishlist (wajib login [A]). Produk nonaktif tidak ditampilkan. */
export default function AccountWishlist() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const productIds = useWishlistStore((s) => s.productIds);
  const items = productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is (typeof products)[number] => !!p && p.active);

  return (
    <div className="card account-panel">
      <div className="account-panel__head">
        <h2>{t('account.wishlist')}</h2>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>{t('account.wishlistEmpty')}</p>
          <NavLink to={path('/shop')} className="btn btn--outline btn--sm">
            {t('account.startShopping')}
          </NavLink>
        </div>
      ) : (
        <div className="grid grid-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
