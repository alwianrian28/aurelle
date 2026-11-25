import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore, resolveCartItem } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useLocalePath, useLocalized, usePrice } from '../hooks/useLocale';
import { useCatalogVersion } from '../lib/catalogSync';
import SmartImage from '../components/SmartImage';
import ProductCard from '../components/ProductCard';
import ChatLink from '../components/ChatLink';
import Icon from '../components/ServiceIcons';
import { products } from '../mocks/catalog';
import WishlistButton from '../components/WishlistButton';
import './Cart.css';

/**
 * F-07 Keranjang (shopping bag).
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
  useCatalogVersion(); // re-render when server stock or prices refresh

  const resolved = items.map((item) => ({ item, ...resolveCartItem(item) }));
  const hasBlocking = resolved.some((r) => r.unavailable || r.exceedsStock);
  const subtotalIdr = resolved.reduce(
    (sum, r) => sum + (r.variant && !r.unavailable ? r.variant.priceIdr * r.item.qty : 0),
    0,
  );
  // Different pieces in the bag (matches the header badge), not the total quantity.
  const count = items.length;

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate(path('/auth/login'), { state: { from: path('/checkout') } });
      return;
    }
    navigate(path('/checkout'));
  };

  // Suggestions: pieces that are not already in the bag.
  const inBag = new Set(items.map((i) => i.productId));
  const suggestions = products.filter((p) => p.active && p.saleType === 'ready_stock' && !inBag.has(p.id)).slice(0, 4);
  const more = (titleKey: 'cart.latest' | 'cart.alsoLike') => suggestions.length > 0 && (
    <section className="cart__more" aria-labelledby="cart-more-title">
      <div className="cart__more-head">
        <h2 id="cart-more-title">{t(titleKey)}</h2>
        <NavLink id="cart-more-all" to={path('/shop')}>{t('cart.shopAllLink')}</NavLink>
      </div>
      <div className="grid grid-4">
        {suggestions.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );

  if (items.length === 0) {
    return (
      <div className="cart">
        <title>{`${t('cart.emptyTitle')} | Aurelle`}</title>
        <div className="container">
          <div className="cart-empty">
            <h1>{t('cart.emptyTitle')}</h1>
            <p className="cart-empty__body">{t('cart.emptyBody')}</p>
            <div className="cart-empty__actions">
              <NavLink id="cart-empty-shop" to={path('/shop')} className="guide-btn">{t('cart.shopAll')}</NavLink>
              <NavLink id="cart-empty-collections" to={path('/collections')} className="guide-btn guide-btn--outline">{t('cart.exploreCollections')}</NavLink>
            </div>
            <p className="cart-empty__hint">
              {isAuthenticated
                ? <NavLink id="cart-empty-wishlist" to={path('/account/wishlist')}>{t('cart.viewWishlist')}</NavLink>
                : <>{t('cart.savedEarlier')} <NavLink id="cart-empty-login" to={path('/auth/login')} state={{ from: path('/account/wishlist') }}>{t('cart.logIn')}</NavLink> {t('cart.loginForWishlist')}</>}
            </p>
          </div>
          {more('cart.latest')}
        </div>
      </div>
    );
  }

  return (
    <div className="cart">
      <title>{`${t('cart.title')} | Aurelle`}</title>
      <div className="container">

        <header className="cart__head">
          <h1>{t('cart.title')}</h1>
          <NavLink id="cart-continue" to={path('/shop')} className="cart__continue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            {t('cart.continueShopping')}
          </NavLink>
        </header>

        <div className="cart__layout">
          <ul className="cart__list">
            {resolved.map(({ item, product, variant, priceChanged, unavailable, exceedsStock, available }) => {
              const name = localized(product?.name);
              const href = product ? path(`/product/${product.slug}`) : path('/shop');
              return (
                <li key={item.variantId} className={`cart-item${unavailable ? ' is-unavailable' : ''}`}>
                  <NavLink to={href} className="cart-item__media" tabIndex={-1} aria-hidden="true">
                    <SmartImage src={product?.media[0]?.src} alt="" category={product?.category ?? 'ring'} />
                  </NavLink>
                  <div className="cart-item__info">
                    <h2><NavLink to={href}>{name}</NavLink></h2>
                    {product && <p className="cart-item__category">{t(`categories.${product.category}`)}</p>}
                    {variant && (
                      <p className="cart-item__variant">
                        {localized(variant.label)}
                        {product && product.variants.length > 1 && <> · <NavLink to={href}>{t('cart.change')}</NavLink></>}
                      </p>
                    )}
                    {priceChanged && !unavailable && <p className="cart-item__flag">{t('cart.priceChanged')}</p>}
                    {unavailable && <p className="cart-item__flag is-error">{t('cart.unavailable')}</p>}
                    {exceedsStock && <p className="cart-item__flag is-error">{t('cart.exceedsStock', { count: available })}</p>}
                  </div>
                  <p className="cart-item__price">{variant ? price(variant.priceIdr * item.qty) : '-'}</p>
                  <div className="cart-item__actions">
                    <div className="cart-item__qty" role="group" aria-label={`${t('cart.quantity')}: ${name}`}>
                      <button type="button" onClick={() => setQty(item.variantId, item.qty - 1)} aria-label={t('cart.decrease')} disabled={unavailable}>−</button>
                      <span aria-live="polite">{item.qty}</span>
                      <button type="button" onClick={() => setQty(item.variantId, item.qty + 1)} aria-label={t('cart.increase')} disabled={unavailable || item.qty >= available}>+</button>
                    </div>
                  </div>
                  <div className="cart-item__links">
                    {/* Same heart as the shop: beats once when saved, then stays red. */}
                    {product && (
                      <WishlistButton productId={product.id} className="cart-item__icon" size={18} />
                    )}
                    <button type="button" className="cart-item__icon" onClick={() => remove(item.variantId)} aria-label={`${t('cart.remove')}: ${name}`} title={t('cart.removeShort')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.500 7V4.500h5V7M6.500 7l.8 12.500h9.400L17.500 7M10 11v5M14 11v5" /></svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="cart__aside">
            <section className="cart-summary" aria-labelledby="cart-summary-title">
              <h2 id="cart-summary-title">{t('cart.summary')}</h2>
              <dl>
                <div><dt>{t('cart.subtotalItems', { count })}</dt><dd>{price(subtotalIdr)}</dd></div>
                <div><dt>{t('cart.shipping')}</dt><dd className="is-muted">{t('cart.shippingAtCheckout')}</dd></div>
                <div className="cart-summary__total"><dt>{t('cart.estimatedTotal')}</dt><dd>{price(subtotalIdr)}</dd></div>
              </dl>
              <button id="cart-checkout" type="button" className="guide-btn cart-summary__cta" disabled={hasBlocking} onClick={handleCheckout}>
                {t('cart.checkout')}
              </button>
              <p className="cart-summary__secure">
                <LockIcon />
                <span>{t('cart.secureCheckout')}</span>
                <span className="cart-summary__brands" aria-hidden="true"><span>VISA</span><span>MC</span><span>QRIS</span></span>
              </p>
              <p className="cart-summary__note">{t('cart.feesAtCheckout')}{!isAuthenticated && ` ${t('cart.loginRequired')}`}</p>
            </section>

            <ul className="cart__service">
              <li><Icon name="delivery" size={18} />{t('cart.serviceDelivery')}</li>
              <li><Icon name="authentic" size={18} />{t('cart.serviceCertificate')}</li>
              <li><Icon name="returns" size={18} /><NavLink id="cart-returns" to={path('/policies/revision-return')}>{t('product.serviceReturns')}</NavLink></li>
              <li><Icon name="whatsapp" size={18} /><span>{t('cart.needHelp')} <ChatLink id="cart-chat" className="cart__text-link" message={{ id: t('cart.chatMessage'), en: t('cart.chatMessage') }}>{t('product.chat')}</ChatLink></span></li>
            </ul>
          </aside>
        </div>

        {more('cart.alsoLike')}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}
