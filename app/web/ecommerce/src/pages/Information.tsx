import { NavLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalePath, useLocalized } from "../hooks/useLocale";
import { faq, policies, storyChapters } from "../content/site";
import { careGuide, sizeChart } from "../content/service";
import NotFound from "./NotFound";
import PageHero from "../components/PageHero";
import "./Information.css";

/** Visual sementara (render model prosedural) — diganti foto resmi brand. */
const HERO_IMAGE: Partial<Record<string, string>> = {
  story: "/media/editorial/story.jpg",
  care: "/media/collections/aurora.jpg",
  size: "/media/categories/ring.jpg",
};

type Kind = "faq" | "policy" | "story" | "guide";
/** F-19: bilingual editorial pages. Open decisions remain explicitly provisional. */
export default function Information({ kind }: { kind: Kind }) {
  const { slug } = useParams();
  const { t } = useTranslation();
  const text = useLocalized();
  const path = useLocalePath();
  const policy = kind === "policy" && slug && Object.hasOwn(policies, slug) ? policies[slug as keyof typeof policies] : undefined;
  if (kind === "policy" && !policy) return <NotFound />;
  if (kind === "guide" && slug !== "size" && slug !== "care") return <NotFound />;
  const title = policy ? text(policy.title) : t(kind === "faq" ? "pages.faqTitle" : kind === "story" ? "pages.storyTitle" : slug === "size" ? "pages.sizeTitle" : "pages.careTitle");
  const intro = policy ? text(policy.intro) : t(kind === "faq" ? "pages.faqIntro" : kind === "story" ? "pages.storyIntro" : slug === "size" ? "pages.sizeIntro" : "pending.draft");
  const heroKey = kind === "guide" ? slug ?? "" : kind;
  const eyebrow = policy ? t("pages.policiesEyebrow") : kind === "faq" ? t("pages.faqEyebrow") : kind === "guide" ? t("pages.guideEyebrow") : "Aurelle";
  return <article className={"container section information" + (HERO_IMAGE[heroKey] ? " information--wide" : "")}>
    <title>{title} — Aurelle</title><meta name="description" content={intro} />
    <PageHero id="information-hero" eyebrow={eyebrow} title={title} intro={intro} image={HERO_IMAGE[heroKey]} variant={HERO_IMAGE[heroKey] ? "split" : "compact"} />
    {(kind === "story" || kind === "guide") && <p className="alert alert--warning">{t("pending.draft")}</p>}
    {kind === "faq" && <div className="information__list">{faq.map((item, index) => <details key={index} className="card information__block"><summary id={"faq-" + index}>{text(item.q)}</summary><p>{text(item.a)}</p>{item.pending && <span className="pill pill--warning">{t("pending.badge")}</span>}</details>)}</div>}
    {policy && <><div className="information__list">{policy.blocks.map((block) => <section key={block.id} id={block.id} className="card information__block"><h2 className="heading-lg">{text(block.title)}</h2>{block.body.map((body, index) => <p key={index}>{text(body)}</p>)}{block.pending && <aside className="alert alert--warning"><div><strong>{t("pending.badge")}</strong><p>{text(block.pending.note)}</p></div></aside>}</section>)}</div><nav className="information__links" aria-label={t("pages.policiesNav")}>{Object.entries(policies).map(([key, value]) => <NavLink id={"policy-link-" + key} key={key} to={path("/policies/" + key)}>{text(value.title)}</NavLink>)}</nav></>}
    {kind === "story" && <div className="information__list information__list--numbered">{storyChapters.map((chapter, index) => <section className="card information__block" key={index} data-index={String(index + 1).padStart(2, "0")}><p className="eyebrow">{text(chapter.eyebrow)}</p><h2 className="heading-lg">{text(chapter.title)}</h2><p>{text(chapter.body)}</p></section>)}</div>}
    {kind === "guide" && slug === "care" && <div className="information__list information__list--numbered information__list--grid">{careGuide.groups.map((group) => <section className="card information__block" key={group.icon}><p className="eyebrow">{text(group.label)}</p><h2 className="heading-lg">{text(group.title)}</h2><ul>{group.tips.map((tip, index) => <li key={index}>{text(tip)}</li>)}</ul></section>)}</div>}
    {kind === "guide" && slug === "size" && <div className="information__table"><table><caption>{t("pages.sizeTitle")}</caption><thead><tr>{sizeChart.ring.columns.map((column, index) => <th key={index}>{text(column)}</th>)}</tr></thead><tbody>{sizeChart.ring.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table><p>{t("pages.sizeHelp")}</p></div>}
  </article>;
}
