import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore, resolveCartItem } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useLocalePath, useLocalized, usePrice } from '../hooks/useLocale';
import SmartImage from '../components/SmartImage';
import ProductCard from '../components/ProductCard';
import { products } from '../mocks/catalog';
import './Cart.css';

/**
 * F-07 Keranjang.
 * - Validasi ulang harga & stok setiap dibuka (FR-07-03): item ditandai jika berubah/habis.
 * - Hanya subtotal; pajak, ongkir, bea dihitung di checkout (FR-07-06).
 * - Checkout wajib login (BR-03, AC-01-01).
 */
export default function Cart() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  const price = usePrice();
  const navigate = useNavigate();
  const { items, remove, setQty } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const resolved = items.map((item) => ({ item, ...resolveCartItem(item) }));
  const hasBlocking = resolved.some((r) => r.unavailable || r.exceedsStock);
  const subtotalIdr = resolved.reduce(
    (sum, r) => sum + (r.variant && !r.unavailable ? r.variant.priceIdr * r.item.qty : 0),
    0,
  );

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate(path('/auth/login'), { state: { from: path('/checkout') } });
      return;
    }
    navigate(path('/checkout'));
  };

  if (items.length === 0) {
    const suggestions = products.filter((p) => p.active && p.saleType === 'ready_stock').slice(0, 4);
    return (
      <div className="container section">
        <div className="cart-empty">
          <span className="cart-empty__icon" aria-hidden="true">◇</span>
          <h1 className="heading-xl">{t('common.cart')}</h1>
          <p className="text-muted">{t('cart.empty')}</p>
          <NavLink id="cart-empty-shop" to={path('/shop')} className="btn btn--primary">
            {t('home.heroCtaPrimary')}
          </NavLink>
        </div>
        <section className="cart-suggest" aria-labelledby="cart-suggest-title">
          <h2 id="cart-suggest-title" className="heading-lg">{t('home.latestTitle')}</h2>
          <div className="grid grid-4">
            {suggestions.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1 className="heading-xl">{t('common.cart')}</h1>

      <div className="cart-layout">
        <ul className="cart-list">
          {resolved.map(({ item, product, variant, priceChanged, unavailable, exceedsStock, available }) => (
            <li key={item.variantId} className={`cart-item ${unavailable ? 'is-unavailable' : ''}`}>
              <div className="cart-item__media">
                <SmartImage src={product?.media[0]?.src} alt="" category={product?.category ?? 'ring'} />
              </div>
              <div className="cart-item__info">
                <h3>{localized(product?.name)}</h3>
                <p className="text-muted text-sm">{localized(variant?.label)}</p>
                {priceChanged && !unavailable && <p className="cart-item__flag">{t('cart.priceChanged')}</p>}
                {unavailable && <p className="cart-item__flag is-error">{t('cart.unavailable')}</p>}
                {exceedsStock && (
                  <p className="cart-item__flag is-error">{t('cart.exceedsStock', { count: available })}</p>
                )}
              </div>
              <div className="cart-item__qty">
                <button
                  onClick={() => setQty(item.variantId, item.qty - 1)}
                  aria-label={t('cart.decrease')}
                  disabled={unavailable}
                >
                  −
                </button>
                <span>{item.qty}</span>
                <button
                  onClick={() => setQty(item.variantId, item.qty + 1)}
                  aria-label={t('cart.increase')}
                  disabled={unavailable || item.qty >= available}
                >
                  +
                </button>
              </div>
              <div className="cart-item__price">{variant ? price(variant.priceIdr * item.qty) : '—'}</div>
              <button className="cart-item__remove" onClick={() => remove(item.variantId)} aria-label={t('cart.remove')}>
                ×
              </button>
            </li>
          ))}
        </ul>

        <aside className="cart-summary card">
          <div className="cart-summary__row">
            <span>{t('common.subtotal')}</span>
            <strong>{price(subtotalIdr)}</strong>
          </div>
          <p className="text-muted text-sm">{t('cart.feesAtCheckout')}</p>
          <button
            className="btn btn--primary btn--block"
            disabled={hasBlocking}
            onClick={handleCheckout}
            id="cart-checkout"
          >
            {t('cart.checkout')}
          </button>
          {!isAuthenticated && <p className="text-muted text-sm">{t('cart.loginRequired')}</p>}
        </aside>
      </div>
    </div>
  );
}
