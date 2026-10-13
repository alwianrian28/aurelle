import { useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { useRequestStore } from '../store/requestStore';
import { BRAND_CONTACT, buildWhatsAppLink } from '../config/brand';
import { faq } from '../content/site';
import './Information.css';
import './Contact.css';

const TOPICS = ['general', 'product', 'order', 'custom', 'payment'] as const;
type Topic = (typeof TOPICS)[number];

const HELP_LINKS: { id: string; to: string; key: string }[] = [
  { id: 'contact-orders', to: '/account/orders', key: 'orders' },
  { id: 'contact-custom', to: '/custom-po', key: 'custom' },
  { id: 'contact-shipping', to: '/policies/shipping', key: 'shipping' },
  { id: 'contact-payment', to: '/policies/payment', key: 'payment' },
  { id: 'contact-revision', to: '/policies/revision-return', key: 'revision' },
  { id: 'contact-size', to: '/guides/size', key: 'size' },
];

/**
 * F-19 Contact (FR-19-05): kontak resmi + CTA WhatsApp.
 * - Kontak resmi belum ditetapkan (OD-17) → tidak menampilkan nomor/email/jam karangan;
 *   CTA WhatsApp nonaktif sampai `BRAND_CONTACT.isPlaceholder` = false.
 * - Pesan WhatsApp hanya memuat nomor pesanan/pengajuan, tanpa PII (FR-09-03, AC-09-02).
 * - `?reason=country&country=XX` datang dari checkout untuk negara yang belum dilayani (§7 F-07).
 */
export default function Contact() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const text = useLocalized();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const orders = useOrderStore((s) => s.orders);
  const requests = useRequestStore((s) => s.requests);

  const countryReason = params.get('reason') === 'country' ? params.get('country') : null;
  const [topic, setTopic] = useState<Topic>(countryReason ? 'order' : 'general');
  const [reference, setReference] = useState('');
  const [copied, setCopied] = useState(false);

  const references = user
    ? [
        ...orders.filter((o) => o.userId === user.id).map((o) => ({ value: o.number, label: `${t('contact.refOrder')} ${o.number}` })),
        ...requests.filter((r) => r.userId === user.id).map((r) => ({ value: r.number, label: `${t('contact.refRequest')} ${r.number}` })),
      ]
    : [];

  const message = [
    t('contact.msgGreeting'),
    t('contact.msgTopic', { topic: t(`contact.topics.${topic}`) }),
    reference ? t('contact.msgReference', { ref: reference }) : '',
    countryReason ? t('contact.msgCountry', { country: countryReason }) : '',
  ]
    .filter(Boolean)
    .join(' ');

  const whatsappReady = !BRAND_CONTACT.isPlaceholder;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false); // clipboard tidak tersedia (mis. konteks tidak aman) — pengguna masih bisa menyalin manual
    }
  };

  return (
    <article className="container section information contact">
      <title>{`${t('pages.contactTitle')} — Aurelle`}</title>
      <meta name="description" content={t('pages.contactIntro')} />

      <header className="information__hero">
        <p className="eyebrow">{t('pages.contactEyebrow')}</p>
        <h1 className="heading-xl">{t('pages.contactTitle')}</h1>
        <p>{t('pages.contactIntro')}</p>
      </header>

      {countryReason && (
        <p className="alert alert--info" role="status" id="contact-country-notice">
          {t('contact.countryNotServed', { country: countryReason })}
        </p>
      )}
      {BRAND_CONTACT.isPlaceholder && <p className="alert alert--warning">{t('pages.contactPending')}</p>}

      <section aria-labelledby="contact-channels">
        <h2 id="contact-channels" className="heading-md contact__title">{t('contact.channelsTitle')}</h2>
        <div className="contact__channels">
          {(['Whatsapp', 'Email', 'Hours'] as const).map((key) => (
            <div key={key} className="card contact__channel">
              <span className="contact__icon" aria-hidden="true">{key === 'Whatsapp' ? '✆' : key === 'Email' ? '✉' : '◷'}</span>
              <h3 className="heading-md">{t(`pages.contact${key}`)}</h3>
              <span className="pill pill--warning">{t('pending.badge')}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="contact__grid">
        <section className="card contact__composer" aria-labelledby="contact-composer-title">
          <h2 id="contact-composer-title" className="heading-md">{t('contact.composerTitle')}</h2>
          <p className="text-muted text-sm">{t('contact.composerIntro')}</p>

          <label className="field">
            {t('contact.topicLabel')}
            <select id="contact-topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
              {TOPICS.map((value) => (
                <option key={value} value={value}>{t(`contact.topics.${value}`)}</option>
              ))}
            </select>
          </label>

          {user ? (
            <label className="field">
              {t('contact.referenceLabel')}
              <select id="contact-reference" value={reference} onChange={(e) => setReference(e.target.value)}>
                <option value="">{t('contact.referenceNone')}</option>
                {references.map((ref) => (
                  <option key={ref.value} value={ref.value}>{ref.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm">
              <NavLink id="contact-login" to={path('/auth/login')} state={{ from: path('/contact') }}>
                {t('contact.loginForRefs')}
              </NavLink>
            </p>
          )}

          <div className="contact__preview">
            <span className="eyebrow">{t('contact.preview')}</span>
            <p id="contact-message-preview">{message}</p>
          </div>

          <div className="contact__actions">
            {whatsappReady ? (
              <a id="contact-whatsapp" className="btn btn--primary" href={buildWhatsAppLink(message)} target="_blank" rel="noopener noreferrer">
                {t('contact.send')}
              </a>
            ) : (
              <button id="contact-whatsapp" type="button" className="btn btn--primary" disabled aria-describedby="contact-whatsapp-note">
                {t('contact.send')}
              </button>
            )}
            <button id="contact-copy" type="button" className="btn btn--outline" onClick={copy}>
              {copied ? `✓ ${t('contact.copied')}` : t('contact.copy')}
            </button>
          </div>
          {!whatsappReady && <p id="contact-whatsapp-note" className="field-hint">{t('contact.sendDisabled')}</p>}
          <p className="field-hint">{t('contact.safety')}</p>
        </section>

        <aside className="contact__aside">
          <section className="card contact__help" aria-labelledby="contact-help-title">
            <h2 id="contact-help-title" className="heading-md">{t('contact.helpTitle')}</h2>
            <p className="text-muted text-sm">{t('pages.contactOrderHelp')}</p>
            <ul className="contact__links">
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

          <section className="card contact__help" aria-labelledby="contact-faq-title">
            <h2 id="contact-faq-title" className="heading-md">{t('contact.faqTitle')}</h2>
            {faq.slice(0, 3).map((item, index) => (
              <details key={index} className="contact__faq">
                <summary id={`contact-faq-${index}`}>{text(item.q)}</summary>
                <p className="text-sm">{text(item.a)}</p>
              </details>
            ))}
            <NavLink id="contact-faq" className="contact__more" to={path('/faq')}>{t('contact.faqMore')}</NavLink>
          </section>
        </aside>
      </div>
    </article>
  );
}
