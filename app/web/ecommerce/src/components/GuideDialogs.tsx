import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalized } from '../hooks/useLocale';
import { useGuideStore } from '../store/guideStore';
import { careGuide, sizeChart, sizeGuideCopy, type SizeKind } from '../content/service';
import Icon from './ServiceIcons';
import ChatLink from './ChatLink';
import './GuideDialogs.css';

/** Native <dialog>: focus containment, Esc and top-layer stacking come from the browser. */
function GuideDialog({ id, eyebrow, title, intro, onClose, children }: {
  id: string; eyebrow: string; title: string; intro?: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return (
    <dialog
      ref={ref}
      id={id}
      className="guide-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <header className="guide-dialog__head">
        <div>
          <p className="guide-dialog__eyebrow">{eyebrow}</p>
          <h2 id={`${id}-title`} className="guide-dialog__title">{title}</h2>
          {intro && <p className="guide-dialog__intro">{intro}</p>}
        </div>
        <button id={`${id}-close`} type="button" className="guide-dialog__close" aria-label={t('common.close')} onClick={onClose}><Icon name="close" size={20} /></button>
      </header>
      <div className="guide-dialog__body">{children}</div>
    </dialog>
  );
}

function SizeChartDialog({ onClose }: { onClose: () => void }) {
  const text = useLocalized();
  const tab = useGuideStore((s) => s.sizeTab);
  const setTab = (next: SizeKind) => useGuideStore.setState({ sizeTab: next });
  const chart = sizeChart[tab];
  return (
    <GuideDialog id="size-chart" eyebrow={text(sizeGuideCopy.eyebrow)} title={text(sizeGuideCopy.chartTitle)} onClose={onClose}>
      <div className="size-chart">
        <aside className="size-chart__how">
          <h3 className="guide-dialog__label">{text(chart.howTitle)}</h3>
          <ol className="size-chart__steps">
            {chart.steps.map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{text(step)}</li>)}
          </ol>
          <p className="size-chart__tip"><strong>{text(sizeGuideCopy.tipLabel)}</strong> {text(chart.tip)}</p>
          <ChatLink id="size-chart-chat" className="size-chart__chat" message={sizeGuideCopy.message}>
            <Icon name="whatsapp" size={18} />{text(sizeGuideCopy.unsure)}
          </ChatLink>
        </aside>
        <div className="size-chart__table">
          <div className="size-chart__tabs" role="tablist" aria-label={text(sizeGuideCopy.chartTitle)}>
            {(Object.keys(sizeChart) as SizeKind[]).map((kind) => (
              <button
                key={kind}
                id={`size-tab-${kind}`}
                type="button"
                role="tab"
                aria-selected={tab === kind}
                aria-controls="size-panel"
                onClick={() => setTab(kind)}
              >{text(sizeChart[kind].tab)}</button>
            ))}
          </div>
          <div id="size-panel" role="tabpanel" aria-labelledby={`size-tab-${tab}`} className="size-chart__scroll">
            <table>
              <thead><tr>{chart.columns.map((column, i) => <th key={i} scope="col">{text(column)}</th>)}</tr></thead>
              <tbody>{chart.rows.map((row) => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="size-chart__note">{text(chart.note)}</p>
        </div>
      </div>
    </GuideDialog>
  );
}

function CareGuideDialog({ onClose }: { onClose: () => void }) {
  const text = useLocalized();
  return (
    <GuideDialog id="care-guide" eyebrow={text(careGuide.eyebrow)} title={text(careGuide.title)} intro={text(careGuide.body)} onClose={onClose}>
      <div className="care-guide">
        {careGuide.groups.map((group) => (
          <section key={group.icon} className="care-guide__card" aria-labelledby={`care-${group.icon}`}>
            <header>
              <Icon name={group.icon} size={22} />
              <div>
                <p className="guide-dialog__label">{text(group.label)}</p>
                <h3 id={`care-${group.icon}`}>{text(group.title)}</h3>
              </div>
            </header>
            <ul>{group.tips.map((tip, i) => <li key={i}>{text(tip)}</li>)}</ul>
          </section>
        ))}
      </div>
      <div className="care-guide__cta">
        <div>
          <p className="care-guide__cta-title">{text(careGuide.ctaTitle)}</p>
          <p>{text(careGuide.ctaBody)}</p>
        </div>
        <ChatLink id="care-guide-chat" className="guide-btn guide-btn--outline" message={careGuide.message}>
          <Icon name="whatsapp" size={18} />{text(careGuide.cta)}
        </ChatLink>
      </div>
    </GuideDialog>
  );
}

/** Mounted once in Layout; opened from the storefront cards and the footer. */
export default function GuideDialogs() {
  const open = useGuideStore((s) => s.open);
  const close = useGuideStore((s) => s.close);
  if (open === 'size') return <SizeChartDialog onClose={close} />;
  if (open === 'care') return <CareGuideDialog onClose={close} />;
  return null;
}

