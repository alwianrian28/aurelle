import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore, resolveCartItem } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useAddressStore } from '../../store/addressStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import { RESERVATION_MINUTES } from '../../store/orderStore';
import { placeOrder, type PlaceOrderResult } from '../../lib/orderSync';
import { useCatalogVersion } from '../../lib/catalogSync';
import { canQuoteLive, loadCourierRates, type CourierRate } from '../../lib/shipping';
import { shippingServices } from '../../mocks/catalog';
import { useLocalePath, useLocalized, usePrice } from '../../hooks/useLocale';
import { computeCostBreakdown, SERVED_COUNTRIES } from '../../utils/checkout';
import { isAddressComplete, type AddressDraft } from '../../utils/address';
import { BRAND_CONTACT, buildWhatsAppLink } from '../../config/brand';
import type { CartItem, PaymentMethod } from '../../types/domain';
import SmartImage from '../../components/SmartImage';
import AddressForm from '../../components/AddressForm';
import EmailVerifyNotice from '../../components/EmailVerifyNotice';
import Icon from '../../components/ServiceIcons';
import './Checkout.css';

const YEAR = new Date().getFullYear();
const FOOT_LINKS = ['shipping', 'payment', 'revision-return', 'privacy', 'terms'] as const;

/**
 * F-08 Checkout ready stock (alur §7.1), on its own page chrome: no site navigation, so
 * nothing pulls the customer away mid-purchase.
 * 1. Pilih alamat → cek negara layanan & kelengkapan (FR-02-03, AC-02-05).
 * 2. Pilih layanan kirim → rincian biaya terpisah (BR-15, AC-08-02). Within Indonesia the
 *    services and prices are the couriers' own, live (Biteship); elsewhere, or when those
 *    cannot be had, the store's own list of services is offered.
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
  const { items, hold } = useCartStore();
  const { addresses, addAddress } = useAddressStore();
  const { currency, usdToIdr } = usePreferenceStore();
  useCatalogVersion(); // re-render when server prices or stock refresh

  const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressId, setAddressId] = useState(defaultAddr?.id ?? '');
  const [adding, setAdding] = useState(false);
  const [serviceId, setServiceId] = useState(shippingServices[0]?.id ?? '');
  const [selectedMethod, setMethod] = useState<PaymentMethod>('card');
  const [agreed, setAgreed] = useState(false);
  const [submitError, setSubmitError] = useState<Extract<PlaceOrderResult, { ok: false }>['reason'] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Harga saat checkout dibuka — dasar deteksi perubahan sebelum submit (AC-08-07). */
  const [openedPrices, setOpenedPrices] = useState<Record<string, number>>(() => snapshotPrices(items));

  // Jika alamat terpilih dihapus, otomatis kembali ke default (diturunkan saat render).
  const address = addresses.find((a) => a.id === addressId) ?? defaultAddr;

  // Live courier rates for this cart and postal code. `rates: null` = not available, use the store's list.
  const liveKey = isAddressComplete(address) && canQuoteLive(address?.country, address?.postalCode)
    ? `${address!.postalCode!.trim()}|${items.map((i) => `${i.variantId}:${i.qty}`).join(',')}` : '';
  const [live, setLive] = useState<{ key: string; rates: CourierRate[] | null } | null>(null);
  const [ratesAsked, setRatesAsked] = useState(0);
  useEffect(() => {
    if (!liveKey) return;
    let cancelled = false;
    void loadCourierRates(items, liveKey.split('|')[0]).then((rates) => { if (!cancelled) setLive({ key: `${liveKey}#${ratesAsked}`, rates }); });
    return () => { cancelled = true; };
    // `items` is covered by liveKey, which lists every variant and quantity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, ratesAsked]);
  const ratesLoading = !!liveKey && live?.key !== `${liveKey}#${ratesAsked}`;
  const liveRates = liveKey && !ratesLoading ? live?.rates ?? null : null;
  const options: DeliveryOption[] = liveRates
    ? liveRates.map((r) => ({ id: `biteship:${r.courier}:${r.service}`, courier: r.courierName, name: r.serviceName, eta: r.eta ? t(r.etaUnit === 'hours' ? 'checkout.etaHours' : 'checkout.etaLive', { range: r.eta }) : r.description, costIdr: r.priceIdr, rate: r }))
    : shippingServices.map((s) => ({ id: s.id, courier: s.courier, name: localized(s.name), eta: t('checkout.eta', { days: s.etaDays }), costIdr: s.costIdr }));
  // The first option (the cheapest live rate) stands in until the customer picks one.
  const service = ratesLoading ? undefined : options.find((o) => o.id === serviceId) ?? options[0];

  // Card and QRIS are both offered to everyone, whatever the language or the currency shown.
  const method: PaymentMethod = selectedMethod;

  const resolved = items.map((item) => ({ item, ...resolveCartItem(item) }));
  const cartBlocked = resolved.some((r) => r.unavailable || r.exceedsStock);
  const subtotalIdr = resolved.reduce((s, r) => s + (r.variant ? r.variant.priceIdr * r.item.qty : 0), 0);

  const addressComplete = isAddressComplete(address);
  const countryServed = !!address && SERVED_COUNTRIES.includes(address.country);
  const costs = service && countryServed ? computeCostBreakdown(subtotalIdr, service.costIdr) : null;

  const emailVerified = !!user?.emailVerified;
  const ready = items.length > 0 && !cartBlocked && emailVerified && addressComplete && countryServed && !!costs;
  const canSubmit = ready && agreed && !submitting;
  // The one thing still standing between the customer and the button.
  const hint = cartBlocked ? t('checkout.cartBlocked')
    : !emailVerified ? t('checkout.verifyRequired')
    : !address ? t('checkout.addAddressFirst')
    : !addressComplete || !countryServed ? t('checkout.hintAddress')
    : !agreed ? t('checkout.hintAgree')
    : '';

  const handleSubmit = async () => {
    if (!canSubmit || !user || !address || !service) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await placeOrder({
      items, expectedPrices: openedPrices, address, paymentMethod: method, currency,
      ...(service.rate ? { shippingRate: { courier: service.rate.courier, service: service.rate.service, expectedPriceIdr: service.costIdr } } : { shippingServiceId: service.id }),
    });

    if (!result.ok) {
      setSubmitting(false);
      // On a price change the refreshed catalog shows the new price; submitting again confirms it.
      if (result.reason === 'price_changed') setOpenedPrices(snapshotPrices(items));
      // The courier's price moved since it was shown: fetch the rates again, the total follows.
      if (result.reason === 'shipping_changed') setRatesAsked((n) => n + 1);
      setSubmitError(result.reason);
      return;
    }
    hold(result.order.id); // the bag is emptied; an order that is never paid gives its pieces back
    // `pay` opens the payment popup on arrival, so the customer does not click twice.
    navigate(path(`/checkout/payment/${result.order.id}`), { replace: true, state: { pay: true } });
  };

  const saveAddress = (draft: AddressDraft) => {
    setAddressId(addAddress(draft).id);
    setAdding(false);
  };

  const chrome = (content: React.ReactNode) => (
    <div className="co">
      <title>{`${t('checkout.title')} | Aurelle`}</title>
      <header className="co-bar">
        <div className="co__inner">
          <NavLink id="checkout-back" to={path('/cart')} className="co-bar__back"><ArrowLeftIcon />{t('checkout.backToBag')}</NavLink>
          <NavLink to={path('/store')} className="co-bar__logo" aria-label="Aurelle">AURELLE</NavLink>
          <span className="co-bar__secure"><LockIcon />{t('checkout.secure')}</span>
        </div>
      </header>
      {content}
      <footer className="co-foot">
        <div className="co__inner">
          <span>&copy; {YEAR} Aurelle</span>
          <nav aria-label={t('help.center')}>
            {FOOT_LINKS.map((key) => <NavLink key={key} to={path(`/policies/${key}`)} target="_blank">{t(`checkout.foot.${key}`)}</NavLink>)}
          </nav>
        </div>
      </footer>
    </div>
  );

  if (items.length === 0) {
    return chrome(
      <div className="co__inner co-empty">
        <h1>{t('checkout.title')}</h1>
        <p>{t('checkout.emptyCart')}</p>
        <NavLink id="checkout-shop" to={path('/shop')} className="guide-btn">{t('account.startShopping')}</NavLink>
      </div>,
    );
  }

  return chrome(
    <div className="co__inner co__layout">
      <div className="co__main">
        <h1>{t('checkout.title')}</h1>

        <section className="co-section" aria-labelledby="co-contact-title">
          <h2 id="co-contact-title">{t('checkout.contact')}</h2>
          <p className="co-contact">
            <strong>{user?.email}</strong>
            {emailVerified && <span className="co-chip"><CheckIcon />{t('acct.verified')}</span>}
            <span>{t('checkout.updatesHere')}</span>
          </p>
          {!emailVerified && <EmailVerifyNotice />}
        </section>

        <section className="co-section" aria-labelledby="co-address-title">
          <div className="co-section__head">
            <h2 id="co-address-title">{t('checkout.shippingAddress')}</h2>
            <NavLink id="checkout-manage-addresses" to={path('/account/addresses')}>{t('checkout.manageAddresses')}</NavLink>
          </div>

          {addresses.length > 0 && (
            <fieldset className="co-options" aria-label={t('checkout.shipTo')}>
              {addresses.map((a) => (
                <label key={a.id} className={`co-option${a.id === address?.id ? ' is-selected' : ''}`}>
                  <input type="radio" name="address" value={a.id} checked={a.id === address?.id} onChange={() => setAddressId(a.id)} />
                  <span className="co-option__body">
                    <strong>{a.recipient}{a.isDefault && <span className="co-tag">{t('address.default')}</span>}</strong>
                    <span>{[a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`.trim(), a.country].filter(Boolean).join(', ')}</span>
                    <small>{a.phoneCountryCode} {a.phone}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {adding ? (
            <div className="co-address-form">
              <AddressForm onSubmit={saveAddress} onCancel={() => setAdding(false)} />
            </div>
          ) : (
            <button id="checkout-add-address" type="button" className="co-add" onClick={() => setAdding(true)}>
              <span aria-hidden="true">+</span>{t('acct.addNewAddress')}
            </button>
          )}

          {address && !addressComplete && (
            <p className="co-alert" role="alert">
              {t('checkout.addressIncomplete')}{' '}
              <NavLink to={path('/account/addresses')}>{t('checkout.manageAddresses')}</NavLink>
            </p>
          )}
          {address && addressComplete && !countryServed && (
            <p className="co-alert" role="alert">
              {t('checkout.countryNotServed', { country: address.country })}{' '}
              <NavLink id="checkout-contact" to={path(`/contact?reason=country&country=${encodeURIComponent(address.country)}`)}>{t('checkout.contactUs')}</NavLink>
            </p>
          )}
        </section>

        {address && addressComplete && countryServed && (
          <section className="co-section" aria-labelledby="co-delivery-title">
            <h2 id="co-delivery-title">{t('checkout.delivery')}</h2>
            {ratesLoading ? <p className="co-note" role="status">{t('checkout.ratesLoading')}</p> : (
              <fieldset className="co-options" aria-label={t('checkout.shippingService')}>
                {options.map((s) => (
                  <label key={s.id} className={`co-option${s.id === service?.id ? ' is-selected' : ''}`}>
                    <input type="radio" name="service" value={s.id} checked={s.id === service?.id} onChange={() => setServiceId(s.id)} />
                    <span className="co-option__body">
                      <strong>{s.courier} · {s.name}</strong>
                      <span>{s.eta}</span>
                    </span>
                    <span className="co-option__aside">{price(s.costIdr)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <p className="co-note">{t('checkout.deliveryNote')}</p>
          </section>
        )}

        <section className="co-section" aria-labelledby="co-payment-title">
          <h2 id="co-payment-title">{t('checkout.stepPayment')}</h2>
          <p className="co-section__sub">{t('checkout.payNote')}</p>
          <fieldset className="co-options" aria-label={t('checkout.paymentMethod')} disabled={!costs}>
            <label className={`co-option${method === 'card' ? ' is-selected' : ''}`}>
              <input id="checkout-method-card" type="radio" name="method" checked={method === 'card'} onChange={() => setMethod('card')} />
              <span className="co-option__body">
                <strong>{t('checkout.cardTitle')}</strong>
                <span>{t('checkout.cardBody')}</span>
              </span>
              <span className="co-brands" aria-hidden="true"><img src="/media/icons/visa.png" alt="" width={40} height={26} /><img src="/media/icons/mastercard.png" alt="" width={40} height={26} /></span>
            </label>
            <label className={`co-option${method === 'qris' ? ' is-selected' : ''}`}>
              <input id="checkout-method-qris" type="radio" name="method" checked={method === 'qris'} onChange={() => setMethod('qris')} />
              <span className="co-option__body">
                <strong>{t('checkout.qris')}</strong>
                <span>{t('checkout.qrisBody')}</span>
              </span>
              <span className="co-brands" aria-hidden="true"><img className="co-brands__qr" src="/media/icons/qris-scan.png" alt="" width={26} height={26} /></span>
            </label>
          </fieldset>
        </section>
      </div>

      <aside className="co-summary" aria-labelledby="co-summary-title">
        <h2 id="co-summary-title">{t('checkout.summary')}</h2>
        <ul className="co-items">
          {resolved.map(({ item, product, variant, unavailable, exceedsStock }) => (
            <li key={item.variantId}>
              <div className="co-items__media">
                <SmartImage src={product?.media[0]?.src} alt="" category={product?.category ?? 'ring'} />
                <span>{item.qty}</span>
              </div>
              <div>
                <strong>{localized(product?.name)}</strong>
                <span>{localized(variant?.label)}</span>
                {(unavailable || exceedsStock) && <em>{t('cart.unavailable')}</em>}
              </div>
              <span>{variant ? price(variant.priceIdr * item.qty) : '-'}</span>
            </li>
          ))}
        </ul>

        <dl className="co-costs">
          <div><dt>{t('common.subtotal')}</dt><dd>{price(subtotalIdr)}</dd></div>
          {costs && service && (
            <>
              <div><dt>{t('checkout.shippingRow', { courier: service.courier })}</dt><dd>{price(costs.shipping)}</dd></div>
              {costs.tax > 0 && <div><dt>{t('common.tax')}</dt><dd>{price(costs.tax)}</dd></div>}
              <div><dt>{t('common.duty')} <small>{t('checkout.estimate')}</small></dt><dd>{price(costs.duty)}</dd></div>
              {costs.other > 0 && <div><dt>{t('common.other')}</dt><dd>{price(costs.other)}</dd></div>}
            </>
          )}
        </dl>
        {costs && (
          <p className="co-total"><span>{t('common.total')}</span><strong id="checkout-total">{price(costs.total)}</strong></p>
        )}
        <p className="co-summary__note">
          {t('checkout.chargedNote', { currency })}
          {currency === 'USD' && <> {t('checkout.usdNote', { rate: `Rp${usdToIdr.toLocaleString('id-ID')}` })}</>}
        </p>

        <label className="co-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={!ready} id="checkout-agree" />
          <span>
            {t('checkout.agreeA')} <NavLink to={path('/policies/terms')} target="_blank">{t('checkout.termsLink')}</NavLink>
            {t('checkout.agreeB')} <NavLink to={path('/policies/revision-return')} target="_blank">{t('checkout.nonReturnable')}</NavLink>.
          </span>
        </label>

        {submitError && (
          <p className="co-alert" role="alert">
            {t(submitError === 'price_changed' ? 'checkout.priceChanged' : submitError === 'shipping_changed' ? 'checkout.shippingChanged' : submitError === 'out_of_stock' ? 'checkout.outOfStock' : submitError === 'unverified' ? 'checkout.verifyRequired' : submitError === 'network' ? 'authPage.networkError' : 'checkout.orderFailed')}{' '}
            <NavLink to={path('/cart')}>{t('checkout.reviewCart')}</NavLink>
          </p>
        )}

        <button className="guide-btn co-submit" disabled={!canSubmit} onClick={() => void handleSubmit()} id="checkout-place-order" aria-describedby="checkout-hint">
          {submitting ? t('checkout.placing') : costs ? t('checkout.placeOrderTotal', { total: price(costs.total) }) : t('checkout.placeOrder')}
        </button>
        <p id="checkout-hint" className="co-summary__hint" role="status">
          {hint}
          {cartBlocked && <> <NavLink to={path('/cart')}>{t('checkout.reviewCart')}</NavLink></>}
        </p>

        <ul className="co-assure">
          <li><LockIcon />{t('checkout.held', { minutes: RESERVATION_MINUTES })}</li>
          <li>
            <Icon name="whatsapp" size={16} />
            <span>
              {t('checkout.questions')}{' '}
              {BRAND_CONTACT.isPlaceholder
                ? <NavLink id="checkout-help" to={path('/contact')}>{t('help.contactPage')}</NavLink>
                : <a id="checkout-help" href={buildWhatsAppLink('')} target="_blank" rel="noopener noreferrer">{t('help.chat')}</a>}
            </span>
          </li>
        </ul>
      </aside>
    </div>,
  );
}

/** A way to ship, as checkout lists it: from the store's own services or a live courier rate. */
interface DeliveryOption { id: string; courier: string; name: string; eta: string; costIdr: number; rate?: CourierRate }

/** Harga katalog terkini per varian di keranjang. */
function snapshotPrices(items: CartItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const { variant } = resolveCartItem(item);
    if (variant) out[item.variantId] = variant.priceIdr;
  }
  return out;
}

const SVG = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
function ArrowLeftIcon() {
  return <svg {...SVG}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
}
function LockIcon() {
  return <svg {...SVG}><rect x="5" y="10.500" width="14" height="9.500" rx="1.500" /><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500" /></svg>;
}
function CheckIcon() {
  return <svg {...SVG} width={12} height={12} strokeWidth={2.2}><path d="M4.500 12.500l5 5 10-11" /></svg>;
}
