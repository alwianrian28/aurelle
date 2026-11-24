import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore, resolveCartItem } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useAddressStore } from '../../store/addressStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import { RESERVATION_MINUTES } from '../../store/orderStore';
import { placeOrder, type PlaceOrderResult } from '../../lib/orderSync';
import { useCatalogVersion } from '../../lib/catalogSync';
import { shippingServices } from '../../mocks/catalog';
import { useLocalePath, useLocalized, usePrice } from '../../hooks/useLocale';
import { computeCostBreakdown, SERVED_COUNTRIES } from '../../utils/checkout';
import { isAddressComplete } from '../../utils/address';
import type { CartItem, PaymentMethod } from '../../types/domain';
import SmartImage from '../../components/SmartImage';
import CostBreakdownList from '../../components/CostBreakdownList';
import EmailVerifyNotice from '../../components/EmailVerifyNotice';
import './Checkout.css';

/**
 * F-08 Checkout ready stock (alur §7.1).
 * 1. Pilih alamat → cek negara layanan & kelengkapan (FR-02-03, AC-02-05).
 * 2. Pilih layanan kirim → rincian biaya terpisah (BR-15, AC-08-02).
 * 3. Pilih metode bayar (hanya lunas, FR-08-02) & setujui ketentuan (FR-08-07).
 * 4. Validasi ulang harga/stok → order awaiting_payment + reservasi (FR-08-04/05).
 */
export default function Checkout() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const localized = useLocalized();
  const price = usePrice();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const { items, clear } = useCartStore();
  const addresses = useAddressStore((s) => s.addresses);
  const { currency, usdToIdr } = usePreferenceStore();
  useCatalogVersion(); // re-render when server prices or stock refresh

  const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressId, setAddressId] = useState(defaultAddr?.id ?? '');
  const [serviceId, setServiceId] = useState(shippingServices[0]?.id ?? '');
  const [selectedMethod, setMethod] = useState<PaymentMethod>('card');
  const [agreed, setAgreed] = useState(false);
  const [submitError, setSubmitError] = useState<Extract<PlaceOrderResult, { ok: false }>['reason'] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Harga saat checkout dibuka — dasar deteksi perubahan sebelum submit (AC-08-07). */
  const [openedPrices, setOpenedPrices] = useState<Record<string, number>>(() => snapshotPrices(items));

  // Jika alamat terpilih dihapus, otomatis kembali ke default (diturunkan saat render).
  const address = addresses.find((a) => a.id === addressId) ?? defaultAddr;
  const service = shippingServices.find((s) => s.id === serviceId);

  // FR-03-07: QRIS hanya didukung untuk IDR (asumsi kerja; OD-11 masih terbuka).
  const qrisAvailable = currency === 'IDR';
  const method: PaymentMethod = qrisAvailable ? selectedMethod : 'card';

  const resolved = items.map((item) => ({ item, ...resolveCartItem(item) }));
  const cartBlocked = resolved.some((r) => r.unavailable || r.exceedsStock);
  const subtotalIdr = resolved.reduce((s, r) => s + (r.variant ? r.variant.priceIdr * r.item.qty : 0), 0);

  const addressComplete = isAddressComplete(address);
  const countryServed = !!address && SERVED_COUNTRIES.includes(address.country);
  const costs = service && countryServed ? computeCostBreakdown(subtotalIdr, service.costIdr) : null;

  const emailVerified = !!user?.emailVerified;
  const canSubmit =
    items.length > 0 &&
    !cartBlocked &&
    emailVerified &&
    addressComplete &&
    countryServed &&
    !!costs &&
    agreed &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !user || !address || !service) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await placeOrder({ items, expectedPrices: openedPrices, address, shippingServiceId: service.id, paymentMethod: method, currency });

    if (!result.ok) {
      setSubmitting(false);
      // On a price change the refreshed catalog shows the new price; submitting again confirms it.
      if (result.reason === 'price_changed') setOpenedPrices(snapshotPrices(items));
      setSubmitError(result.reason);
      return;
    }
    clear();
    navigate(path(`/checkout/payment/${result.order.id}`), { replace: true });
  };

  if (items.length === 0) {
    return (
      <div className="container section checkout-empty">
        <h1 className="heading-xl">{t('checkout.title')}</h1>
        <p className="text-muted">{t('checkout.emptyCart')}</p>
        <NavLink to={path('/shop')} className="btn btn--primary">
          {t('account.startShopping')}
        </NavLink>
      </div>
    );
  }

  return (
    <div className="container section checkout">
      <header className="checkout__head">
        <p className="eyebrow">Aurelle</p>
        <h1 className="heading-xl">{t('checkout.title')}</h1>
      </header>

      <div className="checkout__layout">
        <div className="checkout__main">
          {!emailVerified && <EmailVerifyNotice />}

          {/* 1 — Alamat */}
          <section className="checkout-step card">
            <div className="checkout-step__head">
              <span className="checkout-step__num">1</span>
              <h2>{t('checkout.stepAddress')}</h2>
              <NavLink to={path('/account/addresses')} className="link text-sm checkout-step__aside">
                {t('checkout.manageAddresses')}
              </NavLink>
            </div>

            {addresses.length === 0 ? (
              <div className="alert alert--warning">
                <span>
                  {t('checkout.addAddressFirst')}{' '}
                  <NavLink to={path('/account/addresses')}>{t('address.add')}</NavLink>
                </span>
              </div>
            ) : (
              <fieldset className="option-list" aria-label={t('checkout.shipTo')}>
                {addresses.map((a) => (
                  <label key={a.id} className={`option ${a.id === address?.id ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="address"
                      value={a.id}
                      checked={a.id === address?.id}
                      onChange={() => setAddressId(a.id)}
                    />
                    <span className="option__body">
                      <span className="option__title">
                        {a.recipient}{' '}
                        {a.isDefault && <span className="pill pill--silver">{t('address.default')}</span>}
                      </span>
                      <span className="text-muted">
                        {a.line1}, {a.city}, {a.country} · {a.phoneCountryCode} {a.phone}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {address && !addressComplete && (
              <div className="alert alert--error">
                <span>
                  {t('checkout.addressIncomplete')}{' '}
                  <NavLink to={path('/account/addresses')}>{t('checkout.manageAddresses')}</NavLink>
                </span>
              </div>
            )}
            {address && addressComplete && !countryServed && (
              <div className="alert alert--error">
                <span>
                  {t('checkout.countryNotServed', { country: address.country })}{' '}
                  <NavLink id="checkout-contact" to={path(`/contact?reason=country&country=${encodeURIComponent(address.country)}`)}>{t('checkout.contactUs')}</NavLink>
                </span>
              </div>
            )}

            {address && addressComplete && countryServed && (
              <>
                <h3 className="checkout-step__sub">{t('checkout.shippingService')}</h3>
                <fieldset className="option-list" aria-label={t('checkout.shippingService')}>
                  {shippingServices.map((s) => (
                    <label key={s.id} className={`option ${s.id === serviceId ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="service"
                        value={s.id}
                        checked={s.id === serviceId}
                        onChange={() => setServiceId(s.id)}
                      />
                      <span className="option__body">
                        <span className="option__title">
                          {s.courier} — {localized(s.name)}
                        </span>
                        <span className="text-muted">{t('checkout.eta', { days: s.etaDays })}</span>
                      </span>
                      <span className="option__aside">{price(s.costIdr)}</span>
                    </label>
                  ))}
                </fieldset>
              </>
            )}
          </section>

          {/* 2 — Pembayaran */}
          <section className={`checkout-step card ${!costs ? 'is-locked' : ''}`} aria-disabled={!costs}>
            <div className="checkout-step__head">
              <span className="checkout-step__num">2</span>
              <h2>{t('checkout.stepPayment')}</h2>
            </div>
            <p className="text-sm text-muted">{t('checkout.fullPaymentOnly')}</p>

            <fieldset className="option-list" aria-label={t('checkout.paymentMethod')} disabled={!costs}>
              <label className={`option ${method === 'card' ? 'is-selected' : ''}`}>
                <input type="radio" name="method" checked={method === 'card'} onChange={() => setMethod('card')} />
                <span className="option__body">
                  <span className="option__title">{t('checkout.card')}</span>
                </span>
                <span className="checkout-brands" aria-hidden="true">
                  <span>VISA</span>
                  <span>MC</span>
                </span>
              </label>
              {qrisAvailable ? (
                <label className={`option ${method === 'qris' ? 'is-selected' : ''}`}>
                  <input type="radio" name="method" checked={method === 'qris'} onChange={() => setMethod('qris')} />
                  <span className="option__body">
                    <span className="option__title">{t('checkout.qris')}</span>
                  </span>
                </label>
              ) : (
                <p className="field-hint">{t('checkout.qrisIdrOnly')}</p>
              )}
            </fieldset>

            <label className="check" style={{ marginTop: 'var(--space-2)' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={!costs}
                id="checkout-agree"
              />
              <span>
                {t('checkout.agreeTerms')}{' '}
                <NavLink to={path('/policies/terms')} target="_blank" className="link">
                  {t('checkout.readTerms')}
                </NavLink>
              </span>
            </label>
          </section>
        </div>

        {/* Ringkasan */}
        <aside className="checkout__summary card">
          <h2 className="heading-md">{t('checkout.summary')}</h2>
          <ul className="checkout-items">
            {resolved.map(({ item, product, variant, unavailable, exceedsStock }) => (
              <li key={item.variantId} className="checkout-item">
                <div className="checkout-item__media">
                  <SmartImage src={product?.media[0]?.src} alt="" category={product?.category ?? 'ring'} />
                  <span className="checkout-item__qty">{item.qty}</span>
                </div>
                <div className="checkout-item__info">
                  <span>{localized(product?.name)}</span>
                  <span className="text-muted text-sm">{localized(variant?.label)}</span>
                  {(unavailable || exceedsStock) && (
                    <span className="field-error">{t('cart.unavailable')}</span>
                  )}
                </div>
                <span className="checkout-item__price">{variant ? price(variant.priceIdr * item.qty) : '—'}</span>
              </li>
            ))}
          </ul>

          <hr className="divider" />

          {costs ? (
            <CostBreakdownList costs={costs} format={price} />
          ) : (
            <dl className="dl-list">
              <div>
                <dt>{t('common.subtotal')}</dt>
                <dd>{price(subtotalIdr)}</dd>
              </div>
            </dl>
          )}

          <div className="checkout__notes">
            <p>{t('checkout.estimateNote')}</p>
            <p>{t('checkout.lockNote')}</p>
            {currency === 'USD' && (
              <p>{t('checkout.usdNote', { rate: `Rp${usdToIdr.toLocaleString('id-ID')}` })}</p>
            )}
          </div>

          {cartBlocked && (
            <div className="alert alert--error">
              <span>
                {t('checkout.cartBlocked')} <NavLink to={path('/cart')}>{t('checkout.reviewCart')}</NavLink>
              </span>
            </div>
          )}
          {submitError && (
            <div className="alert alert--error" role="alert">
              <span>
                {t(submitError === 'price_changed' ? 'checkout.priceChanged' : submitError === 'out_of_stock' ? 'checkout.outOfStock' : submitError === 'unverified' ? 'checkout.verifyRequired' : submitError === 'network' ? 'authPage.networkError' : 'checkout.orderFailed')}{' '}
                <NavLink to={path('/cart')}>{t('checkout.reviewCart')}</NavLink>
              </span>
            </div>
          )}
          {!emailVerified && <p className="field-error">{t('checkout.verifyRequired')}</p>}

          <button
            className="btn btn--primary btn--block"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            id="checkout-place-order"
          >
            {t('checkout.placeOrder')}
          </button>
          <p className="field-hint" style={{ textAlign: 'center' }}>
            {t('checkout.reservationNote', { minutes: RESERVATION_MINUTES })}
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Harga katalog terkini per varian di keranjang. */
function snapshotPrices(items: CartItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const { variant } = resolveCartItem(item);
    if (variant) out[item.variantId] = variant.priceIdr;
  }
  return out;
}
