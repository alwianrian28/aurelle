import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { useLocale, useLocalePath } from "../hooks/useLocale";
import { useNewsletterStore } from "../store/newsletterStore";

/** F-06: explicit consent; local simulation, no email sent. */
export default function NewsletterForm({ source }: { source: "home" | "footer" }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return <form className="footer__newsletter form" onSubmit={(event) => {
    event.preventDefault();
    if (!consent) return;
    useNewsletterStore.getState().subscribe(email, locale, source);
    setSubmitted(email); setConfirmed(false);
  }}>
    <h3 className="footer__heading">{t("home.newsletterTitle")}</h3>
    <p className="text-muted text-sm">{t("home.newsletterBody")}</p>
    <p className="field-hint">{t("newsletter.demoNote")}</p>
    <div className="footer__newsletter-row">
      <input id={source + "-newsletter-email"} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} aria-label={t("auth.email")} autoComplete="email" />
      <button id={source + "-newsletter-submit"} className="btn btn--silver btn--sm" type="submit">{t("home.newsletterSubmit")}</button>
    </div>
    <label className="footer__consent">
      <input id={source + "-newsletter-consent"} type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
      <span>{t("home.newsletterConsent")} <NavLink to={path("/policies/privacy")}>{t("footer.privacy")}</NavLink></span>
    </label>
    {submitted && <div role="status"><p>{t(confirmed ? "newsletter.confirmed" : "newsletter.demoPending")}</p>
      {!confirmed && <button id={source + "-newsletter-confirm"} type="button" className="link" onClick={() => { useNewsletterStore.getState().confirm(submitted); setConfirmed(true); }}>{t("newsletter.simulateConfirm")}</button>}
    </div>}
  </form>;
}
