import { NavLink } from 'react-router-dom';
import { useLocale, useLocalePath, useLocalized } from '../hooks/useLocale';
import { useGuideStore } from '../store/guideStore';
import { consultCopy, sizeGuideCopy, trustPoints, trustPolicyLink } from '../content/service';
import { BRAND_CONTACT, BRAND_PENDING } from '../config/brand';
import ChatLink from './ChatLink';
import Icon from './ServiceIcons';
import './StoreService.css';

/** Storefront close: consultation + size guide (flat, two columns), then the trust bar. */
export default function StoreService() {
  const text = useLocalized();
  const locale = useLocale();
  const path = useLocalePath();
  const { openSize, openCare } = useGuideStore();
  // Service hours appear only once the official ones are set.
  const hours = BRAND_CONTACT.isPlaceholder ? null : BRAND_CONTACT.hours[locale];
  const warranty = BRAND_CONTACT.warrantyPeriod?.[locale] ?? BRAND_PENDING.warranty;

  return (
    <>
      <div className="store-service">
        <section className="store-service__col" aria-labelledby="consult-title">
          <p className="svc-eyebrow">{text(consultCopy.eyebrow)}</p>
          <h2 id="consult-title" className="store-service__title">{text(consultCopy.title)}</h2>
          <p className="store-service__body">{text(consultCopy.body)}</p>
          <div className="store-service__actions">
            <ChatLink id="consult-chat" className="guide-btn guide-btn--outline" message={consultCopy.message}>
              <Icon name="whatsapp" size={18} />{text(consultCopy.cta)}
            </ChatLink>
            {hours && <p className="store-service__hours">{text(consultCopy.available)} · {hours}</p>}
          </div>
        </section>

        <section className="store-service__col" aria-labelledby="size-title">
          <p className="svc-eyebrow">{text(sizeGuideCopy.eyebrow)}</p>
          <h2 id="size-title" className="store-service__title">{text(sizeGuideCopy.title)}</h2>
          <p className="store-service__body">{text(sizeGuideCopy.body)}</p>
          <div className="store-service__actions">
            <button id="store-open-size-chart" type="button" className="guide-btn guide-btn--outline" onClick={() => openSize('ring')}>{text(sizeGuideCopy.openChart)}</button>
            <button id="store-open-care-guide" type="button" className="store-service__link" onClick={openCare}>{text(sizeGuideCopy.careLink)}</button>
          </div>
        </section>
      </div>

      <ul className="store-trust" aria-label={locale === 'id' ? 'Jaminan Aurelle' : 'Aurelle promises'}>
        {trustPoints.map((point) => (
          <li key={point.icon}>
            <span className="guide-icon"><Icon name={point.icon} size={28} /></span>
            <div>
              <p className="store-trust__title">{text(point.title).replace('{{period}}', warranty)}</p>
              <p className="store-trust__body">
                {point.policyLink && <><NavLink id="trust-policy" to={path('/policies/revision-return')}>{text(trustPolicyLink)}</NavLink>{' '}</>}
                {text(point.body)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
