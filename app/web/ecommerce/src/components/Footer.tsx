import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NewsletterForm from './NewsletterForm';
import Icon from './ServiceIcons';
import { useLocalePath } from '../hooks/useLocale';
import { useGuideStore } from '../store/guideStore';
import { scrollToTop } from '../lib/gsap';
import { BRAND_CONTACT, buildWhatsAppLink } from '../config/brand';
import type { Category } from '../types/domain';
import './Footer.css';

const YEAR = new Date().getFullYear();
const SHOP_CATEGORIES: Category[] = ['necklace', 'earring', 'ring', 'bracelet'];

/** Global footer: brand, shop, customer care (opens the guide dialogs), about, newsletter. */
export default function Footer() {
  const { t } = useTranslation();
  const path = useLocalePath();
  const { openSize, openCare } = useGuideStore();
  const pending = BRAND_CONTACT.isPlaceholder;
  const whatsappHref = pending ? null : buildWhatsAppLink('');

  const backToTop = () => {
    scrollToTop();
    document.getElementById('main')?.focus({ preventScroll: true });
  };

  const social = [
    { id: 'instagram', label: 'Instagram', href: BRAND_CONTACT.instagramUrl },
    { id: 'tiktok', label: 'TikTok', href: BRAND_CONTACT.tiktokUrl },
    { id: 'whatsapp', label: 'WhatsApp', href: whatsappHref },
    // The envelope is wider than it is tall: a larger box gives it the same visual size as the rest.
    { id: 'mail', label: 'Email', href: pending ? null : `mailto:${BRAND_CONTACT.email}`, size: 24 },
  ] as const;

  return (
    <footer className="footer">
      <div className="container">
      <div className="footer__grid">
        <div className="footer__brand">
          <NavLink to={path('/store')} className="footer__logo" aria-label="Aurelle">AURELLE</NavLink>
          <p className="footer__tagline">{t('footer.tagline')}</p>
          <ul className="footer__social" aria-label={t('footer.social')}>
            {social.map((item) => (
              <li key={item.id}>
                {item.href
                  ? <a id={`footer-${item.id}`} href={item.href} {...(item.id === 'mail' ? {} : { target: '_blank', rel: 'noopener noreferrer' })} aria-label={item.label}><Icon name={item.id} size={'size' in item ? item.size : 20} /></a>
                  : <span aria-label={`${item.label} (${t('footer.socialPending')})`} role="img" title={t('footer.socialPending')}><Icon name={item.id} size={'size' in item ? item.size : 20} /></span>}
              </li>
            ))}
          </ul>
        </div>

        <nav className="footer__col" aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="footer__heading">{t('footer.shop')}</h2>
          <NavLink to={path('/shop')}>{t('footer.shopAll')}</NavLink>
          {SHOP_CATEGORIES.map((c) => <NavLink key={c} to={`${path('/shop')}?category=${c}`}>{t(`categories.${c}`)}</NavLink>)}
          <NavLink to={path('/collections')}>{t('nav.collections')}</NavLink>
        </nav>

        <nav className="footer__col" aria-labelledby="footer-care">
          <h2 id="footer-care" className="footer__heading">{t('footer.customerCare')}</h2>
          <button id="footer-size-guide" type="button" onClick={() => openSize('ring')}>{t('footer.sizeGuide')}</button>
          <button id="footer-care-guide" type="button" onClick={openCare}>{t('footer.care')}</button>
          <NavLink to={path('/track-order')}>{t('nav.track')}</NavLink>
          <NavLink to={path('/faq')}>{t('help.nav.faq')}</NavLink>
          <NavLink to={path('/policies/shipping')}>{t('footer.shippingPolicy')}</NavLink>
          <NavLink to={path('/policies/revision-return')}>{t('footer.revisionReturn')}</NavLink>
          <NavLink to={path('/policies/payment')}>{t('footer.paymentPolicy')}</NavLink>
        </nav>

        <nav className="footer__col" aria-labelledby="footer-about">
          <h2 id="footer-about" className="footer__heading">{t('footer.about')}</h2>
          <NavLink to={path('/our-story')}>{t('nav.ourStory')}</NavLink>
          <NavLink to={path('/contact')}>{t('footer.contactUs')}</NavLink>
        </nav>

        <NewsletterForm source="footer" />
      </div>

      <div className="footer__bottom">
        <span>&copy; {YEAR} Aurelle. {t('footer.rights')}</span>
        <nav aria-label="Legal">
          <NavLink to={path('/policies/privacy')}>{t('footer.privacy')}</NavLink>
          <NavLink to={path('/policies/terms')}>{t('footer.terms')}</NavLink>
          <button id="footer-back-to-top" type="button" className="footer__top" onClick={backToTop}>{t('footer.backToTop')}<Icon name="arrowUp" size={16} /></button>
        </nav>
      </div>
      </div>
    </footer>
  );
}
