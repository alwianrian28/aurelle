import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { useLocale, useLocalePath } from "../hooks/useLocale";
import { api } from "../lib/api";
import { NEWSLETTER_CONSENT_VERSION } from "../config/brand";

type State = "idle" | "sending" | "done" | "invalid" | "consent" | "failed";
const MESSAGE: Record<Exclude<State, "idle" | "sending">, string> = {
  done: "newsletter.confirmed", invalid: "newsletter.invalid", consent: "newsletter.consentRequired", failed: "newsletter.failed",
};

/** F-06: the sign-up is kept by the store (POST /api/newsletter) with the consent given. */
export default function NewsletterForm({ source }: { source: "home" | "footer" }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>("idle");

  // Checked here, not by the browser: its own bubbles are easy to miss on a phone.
  const submit = async () => {
    if (state === "sending") return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setState("invalid");
    if (!consent) return setState("consent");
    setState("sending");
    const res = await api("/newsletter", { body: { email: email.trim(), consent: true, consentVersion: NEWSLETTER_CONSENT_VERSION, locale, source } });
    setState(res.ok ? "done" : res.error === "invalid_input" ? "invalid" : "failed");
    if (res.ok) { setEmail(""); setConsent(false); }
  };

  return <form className="newsletter" noValidate aria-labelledby={source + "-newsletter-title"} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <h2 id={source + "-newsletter-title"} className="footer__heading">{t("footer.newsletter")}</h2>
    <p className="newsletter__body">{t("footer.newsletterBody")}</p>
    <div className="newsletter__field">
      <input id={source + "-newsletter-email"} type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setState("idle"); }} placeholder={t("footer.emailPlaceholder")} aria-label={t("footer.emailPlaceholder")} autoComplete="email" />
      <button id={source + "-newsletter-submit"} type="submit" disabled={state === "sending"}>{t("home.newsletterSubmit")}</button>
    </div>
    <label className="newsletter__consent">
      <input id={source + "-newsletter-consent"} type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setState("idle"); }} />
      <span>{t("footer.consent")} <NavLink to={path("/policies/privacy")}>{t("footer.privacy")}</NavLink>.</span>
    </label>
    {state !== "idle" && state !== "sending" && <p className={`newsletter__status${state === "done" ? " is-ok" : " is-error"}`} role={state === "done" ? "status" : "alert"}>{t(MESSAGE[state])}</p>}
  </form>;
}
