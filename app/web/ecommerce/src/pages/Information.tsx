import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalized } from "../hooks/useLocale";
import { careGuide, sizeChart } from "../content/service";
import NotFound from "./NotFound";
import PageHero from "../components/PageHero";
import "./Information.css";

/** Visual sementara (render model prosedural) — diganti foto resmi brand. */
const HERO_IMAGE: Partial<Record<string, string>> = {
  care: "/media/collections/aurora.jpg",
  size: "/media/categories/ring.jpg",
};

/** F-19 guide pages (size, care). FAQ and policies live in the help center (Help.tsx). */
export default function Information() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const text = useLocalized();
  if (slug !== "size" && slug !== "care") return <NotFound />;
  const title = t(slug === "size" ? "pages.sizeTitle" : "pages.careTitle");
  const intro = t(slug === "size" ? "pages.sizeIntro" : "pending.draft");
  return <article className={"container section information" + (HERO_IMAGE[slug] ? " information--wide" : "")}>
    <title>{title} | Aurelle</title><meta name="description" content={intro} />
    <PageHero id="information-hero" eyebrow={t("pages.guideEyebrow")} title={title} intro={intro} image={HERO_IMAGE[slug]} variant={HERO_IMAGE[slug] ? "split" : "compact"} />
    <p className="alert alert--warning">{t("pending.draft")}</p>
    {slug === "care" && <div className="information__list information__list--numbered information__list--grid">{careGuide.groups.map((group) => <section className="card information__block" key={group.icon}><p className="eyebrow">{text(group.label)}</p><h2 className="heading-lg">{text(group.title)}</h2><ul>{group.tips.map((tip, index) => <li key={index}>{text(tip)}</li>)}</ul></section>)}<section className="card information__block"><p className="eyebrow">{text(careGuide.rhodium.label)}</p><h2 className="heading-lg">{text(careGuide.rhodium.title)}</h2><p>{text(careGuide.rhodium.body)}</p><p>{text(careGuide.rhodium.tip)}</p></section></div>}
    {slug === "size" && <div className="information__table"><table><caption>{t("pages.sizeTitle")}</caption><thead><tr>{sizeChart.ring.columns.map((column, index) => <th key={index}>{text(column)}</th>)}</tr></thead><tbody>{sizeChart.ring.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table><p>{t("pages.sizeHelp")}</p></div>}
  </article>;
}
