import { useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
import { useMyOrders } from '../hooks/useMyOrders';
import { useAuthStore } from '../store/authStore';
import { BRAND_CONTACT, BRAND_PENDING, buildWhatsAppLink } from '../config/brand';
import { faq } from '../content/site';
import Icon from '../components/ServiceIcons';
import './Contact.css';

const TOPICS = ['general', 'order', 'sizing', 'care', 'returns'] as const;
type Topic = (typeof TOPICS)[number];

const HELP_LINKS: { id: string; to: string; key: string }[] = [
  { id: 'contact-orders', to: '/account/orders', key: 'orders' },
  { id: 'contact-shipping', to: '/policies/shipping', key: 'shipping' },
  { id: 'contact-payment', to: '/policies/payment', key: 'payment' },
  { id: 'contact-revision', to: '/policies/revision-return', key: 'revision' },
  { id: 'contact-size', to: '/guides/size', key: 'size' },
  { id: 'contact-care', to: '/guides/care', key: 'care' },
];

/**
 * F-19 Contact (FR-19-05): kontak resmi + CTA WhatsApp.
 * - Kontak resmi tampil dari `BRAND_CONTACT`; bila `isPlaceholder` true, kontak disembunyikan
 *   dan CTA WhatsApp nonaktif.
 * - Pesan WhatsApp hanya memuat nomor pesanan, tanpa PII (FR-09-03, AC-09-02).
 * - `?reason=country&country=XX` datang dari checkout untuk negara yang belum dilayani (§7 F-07).
 */
export default function Contact() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const text = useLocalized();
  const [params] = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const orders = useMyOrders();

  const countryReason = params.get('reason') === 'country' ? params.get('country') : null;
  const [topic, setTopic] = useState<Topic>(countryReason ? 'order' : 'general');
  const [reference, setReference] = useState('');

  // Only an order number may travel with the message (no names, emails or addresses).
  const orderNumber = reference.trim().replace(/[^\w-]/g, '').slice(0, 30);
  const message = [
    t('contact.msgGreeting'),
    t(`contact.messages.${topic}`),
    orderNumber ? t('contact.msgReference', { ref: orderNumber }) : '',
    countryReason ? t('contact.msgCountry', { country: countryReason }) : '',
  ].filter(Boolean).join(' ');

  const ready = !BRAND_CONTACT.isPlaceholder;
  const mailto = `mailto:${BRAND_CONTACT.email}?subject=${encodeURIComponent(t('contact.emailSubject', { topic: t(`contact.topics.${topic}`) }))}&body=${encodeURIComponent(message)}`;
  const half = Math.ceil(faq.length / 2);

  return (
    <article className="contact">
      <title>{`${t('nav.contact')} | Aurelle`}</title>
      <meta name="description" content={t('contact.intro')} />

      <div className="container contact__inner">
        <header className="contact__head">
          <h1>{t('contact.title')}</h1>
          <p>{t('contact.intro')}</p>
        </header>

        {countryReason && (
          <p className="alert alert--info contact__notice" role="status" id="contact-country-notice">
            {t('contact.countryNotServed', { country: countryReason })}
          </p>
        )}
        {!ready && <p className="alert alert--warning contact__notice">{t('pages.contactPending')}</p>}

        <div className="contact__grid">
          <section className="contact-composer" aria-labelledby="contact-composer-title">
            <h2 id="contact-composer-title">{t('contact.composerTitle')}</h2>
            <p className="contact-composer__intro">{t('contact.composerIntro')}</p>

            <fieldset className="contact-composer__topics">
              <legend>{t('contact.topicLabel')}</legend>
              {TOPICS.map((value) => (
                <button key={value} id={`contact-topic-${value}`} type="button" aria-pressed={topic === value} onClick={() => setTopic(value)}>
                  {t(`contact.topics.${value}`)}
                </button>
              ))}
            </fieldset>

            <div className="contact-composer__field">
              <div className="contact-composer__label">
                <label htmlFor="contact-reference">{t('contact.referenceLabel')} <span>{t('contact.optional')}</span></label>
                {!isAuthenticated && (
                  <NavLink id="contact-login" to={path('/auth/login')} state={{ from: path('/contact') }}>{t('contact.loginForRefs')}</NavLink>
                )}
              </div>
              <input
                id="contact-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t('contact.referencePlaceholder')}
                list={orders.length > 0 ? 'contact-orders-list' : undefined}
                autoComplete="off"
                maxLength={30}
              />
              {orders.length > 0 && (
                <datalist id="contact-orders-list">
                  {orders.map((o) => <option key={o.id} value={o.number} />)}
                </datalist>
              )}
            </div>

            <div className="contact-composer__preview">
              <p>{t('contact.preview')}</p>
              <p id="contact-message-preview" aria-live="polite">{message}</p>
            </div>

            <div className="contact-composer__actions">
              {ready ? (
                <a id="contact-whatsapp" className="guide-btn" href={buildWhatsAppLink(message)} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" size={18} />{t('contact.send')}
                </a>
              ) : (
                <button id="contact-whatsapp" type="button" className="guide-btn" disabled aria-describedby="contact-whatsapp-note">
                  <Icon name="whatsapp" size={18} />{t('contact.send')}
                </button>
              )}
              {ready && <a id="contact-email" className="guide-btn guide-btn--outline" href={mailto}>{t('contact.emailInstead')}</a>}
            </div>
            {!ready && <p id="contact-whatsapp-note" className="contact-composer__note">{t('contact.sendDisabled')}</p>}
            <p className="contact-composer__note"><ShieldIcon />{t('contact.safety')}</p>
          </section>

          <aside className="contact__aside">
            <section aria-labelledby="contact-details-title">
              <h2 id="contact-details-title" className="contact__label">{t('contact.detailsTitle')}</h2>
              <ul className="contact-details">
                <li>
                  <Icon name="whatsapp" size={20} />
                  <div>
                    <p>{t('pages.contactWhatsapp')}</p>
                    {ready
                      ? <a id="contact-detail-whatsapp" href={buildWhatsAppLink('')} target="_blank" rel="noopener noreferrer">{BRAND_CONTACT.whatsappDisplay}</a>
                      : <span>{BRAND_PENDING.whatsapp}</span>}
                  </div>
                </li>
                <li>
                  <Icon name="mail" size={20} />
                  <div>
                    <p>{t('pages.contactEmail')}</p>
                    {ready
                      ? <a id="contact-detail-email" href={`mailto:${BRAND_CONTACT.email}`}>{BRAND_CONTACT.email}</a>
                      : <span>{BRAND_PENDING.email}</span>}
                  </div>
                </li>
                <li>
                  <ClockIcon />
                  <div>
                    <p>{t('pages.contactHours')}</p>
                    {ready ? (
                      <dl className="contact-details__hours">
                        {BRAND_CONTACT.hoursRows.map((row) => (
                          <div key={row.time + row.days.en}><dt>{text(row.days)}</dt><dd>{row.time}</dd></div>
                        ))}
                      </dl>
                    ) : <span>{BRAND_PENDING.hours}</span>}
                    <p className="contact-details__note">{BRAND_CONTACT.hoursNote ? text(BRAND_CONTACT.hoursNote) : BRAND_PENDING.hoursNote}</p>
                  </div>
                </li>
              </ul>
            </section>

            <section aria-labelledby="contact-help-title">
              <h2 id="contact-help-title" className="contact__label">{t('contact.helpTitle')}</h2>
              <ul className="contact-links">
                {HELP_LINKS.map((link) => (
                  <li key={link.id}>
                    <NavLink id={link.id} to={path(link.to)}>
                      <span>{t(`contact.links.${link.key}`)}</span>
                      <span aria-hidden="true">→</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>

      <section className="contact-faq" aria-labelledby="contact-faq-title">
        <div className="container contact__inner">
          <div className="contact-faq__head">
            <h2 id="contact-faq-title">{t('contact.faqTitle')}</h2>
            <NavLink id="contact-faq" to={path('/faq')}>{t('contact.faqMore')}</NavLink>
          </div>
          <div className="contact-faq__cols">
            {[faq.slice(0, half), faq.slice(half)].map((column, c) => (
              <div key={c}>
                {column.map((item, index) => (
                  <details key={index} name="contact-faq" open={c === 0 && index === 0}>
                    <summary id={`contact-faq-${c * half + index}`}>{text(item.q)}</summary>
                    <p>{text(item.a)}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l7 2.5v5.5c0 4.2-2.9 7.6-7 9-4.1-1.400-7-4.800-7-9V6z" /><path d="M9 12l2.200 2.200L15.200 10" />
    </svg>
  );
}
