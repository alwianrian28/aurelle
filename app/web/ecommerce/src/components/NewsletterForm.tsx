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
  return <form className="newsletter" aria-labelledby={source + "-newsletter-title"} onSubmit={(event) => {
    event.preventDefault();
    if (!consent) return;
    useNewsletterStore.getState().subscribe(email, locale, source);
    setSubmitted(email); setConfirmed(false);
  }}>
    <h2 id={source + "-newsletter-title"} className="footer__heading">{t("footer.newsletter")}</h2>
    <p className="newsletter__body">{t("footer.newsletterBody")}</p>
    <div className="newsletter__field">
      <input id={source + "-newsletter-email"} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("footer.emailPlaceholder")} aria-label={t("footer.emailPlaceholder")} autoComplete="email" />
      <button id={source + "-newsletter-submit"} type="submit">{t("home.newsletterSubmit")}</button>
    </div>
    <label className="newsletter__consent">
      <input id={source + "-newsletter-consent"} type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
      <span>{t("footer.consent")} <NavLink to={path("/policies/privacy")}>{t("footer.privacy")}</NavLink>.</span>
    </label>
    {submitted && <div className="newsletter__status" role="status"><p>{t(confirmed ? "newsletter.confirmed" : "newsletter.demoPending")}</p>
      {!confirmed && <button id={source + "-newsletter-confirm"} type="button" className="link" onClick={() => { useNewsletterStore.getState().confirm(submitted); setConfirmed(true); }}>{t("newsletter.simulateConfirm")}</button>}
    </div>}
  </form>;
}
