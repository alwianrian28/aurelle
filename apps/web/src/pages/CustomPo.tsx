import { useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalePath, useLocalized } from "../hooks/useLocale";
import { useAuthStore } from "../store/authStore";
import { useAddressStore } from "../store/addressStore";
import { useRequestStore, type RequestDraft } from "../store/requestStore";
import { products } from "../mocks/catalog";
import { customJourney, paymentSchemes } from "../content/site";
import { isAddressComplete } from "../utils/address";
import EmailVerifyNotice from "../components/EmailVerifyNotice";
import PageHero from "../components/PageHero";
import type { Category, Currency, RequestKind } from "../types/domain";
import "./Information.css";

/** F-09 / AC-09-01: preserve draft across login and profile/address navigation. */
export default function CustomPo() {
  const { t } = useTranslation(); const text = useLocalized(); const path = useLocalePath();
  const navigate = useNavigate(); const location = useLocation(); const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const addresses = useAddressStore((s) => s.addresses);
  const { pendingDraft, saveDraft, createRequest } = useRequestStore();
  const [draft, setDraft] = useState<RequestDraft>(() => {
    const product = products.find((p) => p.slug === params.get("ref") && p.active);
    return pendingDraft ?? { kind: product?.saleType === "po" ? "po" : "custom", category: product?.category ?? "ring", productRef: product ? { productId: product.id, slug: product.slug, name: product.name } : undefined, designReference: "", material: "", size: "", engraving: "", budgetAmount: "", budgetCurrency: "IDR", quantity: 1, addressId: "", notes: "" };
  });
  const [error, setError] = useState(""); const [number, setNumber] = useState("");
  const update = <K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const address = addresses.find((a) => a.id === draft.addressId);
  const profileComplete = !!user && user.username.trim().length >= 3 && /^\+\d{1,4}$/.test(user.phoneCountryCode ?? "") && /^\d{6,15}$/.test((user.phone ?? "").replace(/[\s-]/g, ""));
  const leaveFor = (destination: string) => { saveDraft(draft); navigate(path(destination), { state: { from: location.pathname + location.search } }); };
  return <article className="container section information information--wide custom-po">
    <title>{t("customPo.title")} — Aurelle</title><meta name="description" content={t("customPo.intro")} />
    <PageHero id="custom-po-hero" eyebrow={t("customPo.eyebrow")} title={t("customPo.title")} intro={t("customPo.intro")} image="/media/editorial/custom.jpg">
      <a id="custom-po-jump-form" className="btn btn--primary" href="#custom-po-form">{t("customPo.formTitle")}</a>
    </PageHero>
    <section><h2 className="heading-lg">{t("customPo.journeyTitle")}</h2><ol className="journey">{customJourney.map((step, index) => <li key={index}><h3 className="heading-md">{text(step.title)}</h3><p>{text(step.body)}</p></li>)}</ol></section>
    <section className="custom-po__schemes"><h2 className="heading-lg">{t("customPo.schemesTitle")}</h2><div className="grid grid-3 information__list">{paymentSchemes.map((scheme, index) => <div key={index} className="card information__block"><h3>{text(scheme.title)}</h3><p>{text(scheme.body)}</p></div>)}</div><p className="text-muted">{t("customPo.schemesNote")}</p></section>
    <section id="custom-po-form" className="card information__block information__list custom-po__form">
      <h2 className="heading-lg">{t(number ? "customPo.successTitle" : "customPo.formTitle")}</h2>
      <p className="alert alert--info">{t("newsletter.demoNote")}</p>
      {number ? <><p role="status">{t("customPo.successBody", { number })}</p><p className="alert alert--warning">{t("customPo.placeholderContact")}</p><NavLink id="request-view-account" className="btn btn--primary" to={path("/account/requests")}>{t("customPo.viewRequests")}</NavLink></> : <>
      {user && !user.emailVerified && <EmailVerifyNotice />}
      <form className="form" onSubmit={(event) => {
        event.preventDefault(); setError("");
        if (!user) { leaveFor("/auth/login"); return; }
        if (!user.emailVerified || !profileComplete || !isAddressComplete(address)) { setError("request.completeProfile"); return; }
        if (!draft.material.trim() || !draft.size.trim() || (!draft.productRef && !draft.designReference.trim()) || !Number.isInteger(draft.quantity) || draft.quantity < 1 || (draft.budgetAmount !== "" && (!Number.isFinite(Number(draft.budgetAmount)) || Number(draft.budgetAmount) < 0))) { setError("request.invalidFields"); return; }
        if (address) setNumber(createRequest({ userId: user.id, draft, address }).number);
      }}>
        <div className="form-row"><label className="field">{t("customPo.kind")}<select id="request-kind" value={draft.kind} onChange={(e) => update("kind", e.target.value as RequestKind)}><option value="custom">{t("customPo.kindCustom")}</option><option value="po">{t("customPo.kindPo")}</option></select></label>
        <label className="field">{t("customPo.category")}<select id="request-category" value={draft.category} onChange={(e) => update("category", e.target.value as Category)}>{(["ring", "bracelet", "necklace", "earring"] as const).map((category) => <option key={category} value={category}>{t("categories." + category)}</option>)}</select></label></div>
        {draft.productRef && <p>{t("customPo.productRef")}: {text(draft.productRef.name)} <button id="request-remove-reference" className="link" type="button" onClick={() => update("productRef", undefined)}>{t("customPo.removeRef")}</button></p>}
        {(["designReference", "material", "size", "engraving", "notes"] as const).map((key) => <label className="field" key={key}>{t("customPo." + key)}<textarea id={"request-" + key} value={draft[key]} onChange={(e) => update(key, e.target.value)} maxLength={2000} /></label>)}
        <div className="form-row"><label className="field">{t("customPo.quantity")}<input id="request-quantity" type="number" min="1" step="1" required value={draft.quantity} onChange={(e) => update("quantity", Number(e.target.value))} /></label><label className="field">{t("customPo.budget")}<input id="request-budget" type="number" min="0" step="any" value={draft.budgetAmount} onChange={(e) => update("budgetAmount", e.target.value)} /></label></div>
        <label className="field">{t("common.currency")}<select id="request-currency" value={draft.budgetCurrency} onChange={(e) => update("budgetCurrency", e.target.value as Currency)}><option>IDR</option><option>USD</option></select></label>
        {user && <><label className="field">{t("customPo.address")}<select id="request-address" value={draft.addressId} onChange={(e) => update("addressId", e.target.value)}><option value="">—</option>{addresses.map((a) => <option key={a.id} value={a.id}>{a.recipient} — {a.line1}, {a.country}</option>)}</select></label><div className="information__links"><button id="request-manage-address" className="link" type="button" onClick={() => leaveFor("/account/addresses")}>{t("checkout.manageAddresses")}</button><button id="request-manage-profile" className="link" type="button" onClick={() => leaveFor("/account/profile")}>{t("account.profile")}</button></div></>}
        {!user && <p>{t("customPo.loginNotice")}</p>}{error && <p className="field-error" role="alert">{t(error)}</p>}
        <button id="request-submit" className="btn btn--primary" type="submit">{t(user ? "customPo.submit" : "customPo.loginToSubmit")}</button>
      </form></>}
    </section>
  </article>;
}
