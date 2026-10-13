import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import { useRequestStore } from "../../store/requestStore";
import { useLocalePath, useLocalized } from "../../hooks/useLocale";

/** F-09: customer-owned requests; production authorization belongs on the server. */
export default function AccountRequests() {
  const { t } = useTranslation(); const path = useLocalePath(); const text = useLocalized();
  const user = useAuthStore((s) => s.user);
  const requests = useRequestStore((s) => s.requests).filter((r) => r.userId === user?.id);
  return <><h2 className="heading-lg">{t("account.requests")}</h2><NavLink id="requests-new" className="btn btn--outline" to={path("/custom-po")}>{t("request.start")}</NavLink>
    {!requests.length && <p>{t("request.empty")}</p>}
    {requests.map((request) => <article key={request.id} className="card account-panel">
      <h3 className="heading-md">{request.number}</h3><span className="pill">{t("request.status." + request.status)}</span>
      <p>{t("request.kind." + request.kind)} · {t("categories." + request.category)} · {request.quantity}</p>
      {request.productRef && <p>{text(request.productRef.name)}</p>}
      <dl className="dl-list">{(["designReference", "material", "size", "engraving", "notes"] as const).map((key) => <div key={key}><dt>{t("customPo." + key)}</dt><dd>{request[key] || "—"}</dd></div>)}</dl>
      <p>{t("request.nextStep")}</p><p className="field-hint">{t("request.demoSaved")}</p>
    </article>)}
  </>;
}
