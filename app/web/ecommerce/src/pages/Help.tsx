import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocale, useLocalePath, useLocalized } from '../hooks/useLocale';
import { intlLocale } from '../i18n';
import { faqGroups, policies, type PolicySlug } from '../content/site';
import { BRAND_CONTACT, BRAND_PENDING, buildWhatsAppLink } from '../config/brand';
import Icon from '../components/ServiceIcons';
import NotFound from './NotFound';
import './Help.css';

const POLICY_ORDER: PolicySlug[] = ['shipping', 'payment', 'revision-return', 'privacy', 'terms'];
/** Shown until a policy has an approved publication date. */
const PENDING_DATE = '[DATE]';

/**
 * F-19 Help center: the FAQ and the five policies share one layout (side navigation,
 * "at a glance", sections, contact call-out). Terms that still wait on a decision are shown
 * as "To add" rows, never as final rules (FR-19-04, AC-19-02).
 */
export default function Help({ kind }: { kind: 'faq' | 'policy' }) {
  const { slug } = useParams();
  const { t } = useTranslation();
  const text = useLocalized();
  const path = useLocalePath();
  const locale = useLocale();

  const policy = kind === 'policy' && slug && Object.hasOwn(policies, slug) ? policies[slug as PolicySlug] : undefined;
  if (kind === 'policy' && !policy) return <NotFound />;

  const title = policy ? text(policy.title) : t('help.faqTitle');
  const intro = policy ? text(policy.intro) : t('help.faqIntro');
  const updated = policy?.updated
    ? new Date(policy.updated).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })
    : PENDING_DATE;
  const ready = !BRAND_CONTACT.isPlaceholder;
  const whatsapp = (id: string, className?: string) => ready ? (
    <a id={id} className={className} href={buildWhatsAppLink('')} target="_blank" rel="noopener noreferrer">
      <Icon name="whatsapp" size={18} />{t('help.chat')}
    </a>
  ) : (
    <NavLink id={id} className={className} to={path('/contact')}>
      <Icon name="whatsapp" size={18} />{t('help.chat')}
    </NavLink>
  );

  return (
    <article className="help">
      <title>{`${title} | Aurelle`}</title>
      <meta name="description" content={intro} />

      <div className="container help__inner">

        <div className="help__layout">
          <aside className="help__side">
            <nav aria-labelledby="help-nav-title">
              <h2 id="help-nav-title" className="help__label">{t('help.center')}</h2>
              <ul className="help__nav">
                <li><NavLink id="help-nav-faq" to={path('/faq')} end>{t('help.nav.faq')}</NavLink></li>
                {POLICY_ORDER.map((key) => (
                  <li key={key}><NavLink id={`help-nav-${key}`} to={path(`/policies/${key}`)}>{t(`help.nav.${key}`)}</NavLink></li>
                ))}
              </ul>
            </nav>
            <section className="help__card" aria-labelledby="help-card-title">
              <h2 id="help-card-title">{t('help.stillNeed')}</h2>
              {ready ? (
                <dl>
                  {BRAND_CONTACT.hoursRows.map((row) => (
                    <div key={row.time + row.days.en}><dt>{text(row.days)}</dt><dd>{row.time}</dd></div>
                  ))}
                </dl>
              ) : <p>{BRAND_PENDING.hours}</p>}
              {whatsapp('help-side-whatsapp')}
            </section>
          </aside>

          <div className="help__main">
            <header className="help__head">
              <p className="help__label">{t(policy ? 'help.eyebrowPolicies' : 'help.eyebrowHelp')}</p>
              <h1>{title}</h1>
              <p className="help__intro">{intro}</p>
              <p className="help__updated">{t('help.updated', { date: updated })}</p>
            </header>

            {policy ? (
              <>
                <section className="help__glance" aria-labelledby="help-glance-title">
                  <h2 id="help-glance-title" className="help__label">{t('help.glance')}</h2>
                  <ul>
                    {policy.glance.map((point, index) => <li key={index}><CheckIcon />{text(point)}</li>)}
                  </ul>
                </section>
                {policy.blocks.map((block) => (
                  <section key={block.id} id={block.id} className="help__section">
                    <h2>{text(block.title)}</h2>
                    {block.body.map((body, index) => <p key={index}>{text(body)}</p>)}
                    {block.pending && (
                      <p className="help__todo"><span>{t('help.toAdd')}</span>{text(block.pending.note)}</p>
                    )}
                  </section>
                ))}
              </>
            ) : (
              faqGroups.map((group) => (
                <section key={group.id} className="help__faq" aria-labelledby={`help-faq-${group.id}`}>
                  <h2 id={`help-faq-${group.id}`} className="help__label">{text(group.title)}</h2>
                  {group.items.map((item, index) => (
                    <details key={index} name="help-faq">
                      <summary id={`faq-${group.id}-${index}`}>{text(item.q)}</summary>
                      <p>{text(item.a)}</p>
                    </details>
                  ))}
                </section>
              ))
            )}

            <section className="help__cta" aria-labelledby="help-cta-title">
              <h2 id="help-cta-title">{t('help.ctaTitle')}</h2>
              <p>{t('help.ctaBody')}</p>
              <div>
                {whatsapp('help-cta-whatsapp', 'guide-btn help__cta-primary')}
                <NavLink id="help-cta-contact" className="guide-btn help__cta-ghost" to={path('/contact')}>{t('help.contactPage')}</NavLink>
              </div>
            </section>
          </div>
        </div>
      </div>
    </article>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}
