import NewsletterForm from "./NewsletterForm";
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../hooks/useLocale';
import './Footer.css';

const YEAR = new Date().getFullYear();

/**
 * Footer global — §5.1: panduan ukuran, perawatan, pengiriman, revisi/retur,
 * pembayaran, privacy, terms, kontak, form newsletter [B].
 */
export default function Footer() {
  const { t } = useTranslation();
  const path = useLocalePath();

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <div className="footer__logo"><img src="/favicon.svg" width="44" height="44" alt="" />AURELLE</div>
          <p className="text-muted text-sm">{t('footer.tagline')}</p>
        </div>

        <div className="footer__col">
          <h4 className="footer__heading">{t('nav.shop')}</h4>
          <NavLink to={path('/shop')}>{t('nav.shop')}</NavLink>
          <NavLink to={path('/collections')}>{t('nav.collections')}</NavLink>
          <NavLink to={path('/custom-po')}>{t('nav.customPo')}</NavLink>
        </div>

        <div className="footer__col">
          <h4 className="footer__heading">{t('footer.sizeGuide')}</h4>
          <NavLink to={path('/guides/size')}>{t('footer.sizeGuide')}</NavLink>
          <NavLink to={path('/guides/care')}>{t('footer.care')}</NavLink>
          <NavLink to={path('/policies/shipping')}>{t('footer.shippingPolicy')}</NavLink>
          <NavLink to={path('/policies/revision-return')}>{t('footer.revisionReturn')}</NavLink>
          <NavLink to={path('/policies/payment')}>{t('footer.paymentPolicy')}</NavLink>
        </div>

        <div className="footer__col">
          <h4 className="footer__heading">{t('footer.contact')}</h4>
          <NavLink to={path('/contact')}>{t('footer.contact')}</NavLink>
          <NavLink to={path('/policies/privacy')}>{t('footer.privacy')}</NavLink>
          <NavLink to={path('/policies/terms')}>{t('footer.terms')}</NavLink>
        </div>

        <NewsletterForm source="footer" />
      </div>

      <div className="container footer__bottom">
        <span>&copy; {YEAR} Aurelle. {t('footer.rights')}</span>
      </div>
    </footer>
  );
}
