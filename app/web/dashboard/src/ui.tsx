import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { upload } from './api';
import { PAGE, PAYMENT, STATUS, isMediaSrc, media, prepareImage, saveError } from './lib';
import type { Tone } from './lib';
import type { OrderStatus } from './types';

/* ------------------------------------------------------------------ icons */

const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
  tag: <path d="M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4zM7.5 7.5h.01" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  truck: <><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></>,
  box: <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7 12 12l8.7-5M12 22V12" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  printer: <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
  alert: <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  more: <><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></>,
  filter: <path d="M3 6h18M7 12h10M10 18h4" />,
  check: <path d="m20 6-11 11-5-5" />,
  layers: <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
export function PaymentPill({ status }: { status: string }) {
  const tone: Tone = status === 'paid' ? 'green' : status === 'failed' || status === 'expired' ? 'red' : 'grey';
  return <Pill tone={tone}>{PAYMENT[status] ?? status}</Pill>;
}
/** Where the parcel is. Nothing to show while the order still waits for payment. */
export function FulfillmentPill({ status }: { status: OrderStatus }) {
  if (status === 'awaiting_payment') return <span className="dash" aria-label="Not started">—</span>;
  const label = status === 'confirmed' ? 'To ship' : status === 'preparing' ? 'Packing' : STATUS[status];
  const tone: Tone = status === 'shipped' ? 'blue' : status === 'delivered' ? 'green' : status === 'cancelled' ? 'red' : 'amber';
  return <Pill tone={tone}>{label}</Pill>;
}

/* ------------------------------------------------------------- components */

/** Product photo, or a neutral placeholder when there is none or it fails to load. */
export function Thumb({ src, size = 44 }: { src?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {src && !failed ? <img src={media(src)} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Icon name="image" size={Math.min(18, size / 2)} />}
    </span>
  );
}

export function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <button type="button" id={id} role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}><span /></button>;
}

/** A labelled native select styled as one control: "Period  Last 7 days ⌄". */
export function Select<T extends string>({ id, label, value, onChange, options }: { id: string; label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <label className="select" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
      <Icon name="chevron" size={14} />
    </label>
  );
}

/**
 * A button that opens a floating panel. The panel is fixed to the viewport so a scrolling
 * table cannot clip it; it closes on Escape, on a click outside, and when the page scrolls.
 */
export function Popover({ id, label, className = '', panelClass = '', trigger, children }: {
  id: string; label: string; className?: string; panelClass?: string; trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current || !panel.current) return;
    const b = button.current.getBoundingClientRect();
    const height = panel.current.offsetHeight;
    const below = b.bottom + 8 + height <= window.innerHeight || b.top - 8 - height < 0;
    setPlace({ top: below ? b.bottom + 8 : b.top - 8 - height, right: Math.max(8, window.innerWidth - b.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); button.current?.focus(); } };
    const onScroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button ref={button} type="button" id={id} className={className} aria-label={label} aria-haspopup="true" aria-expanded={open} onClick={() => { setPlace({ visibility: 'hidden' }); setOpen((v) => !v); }}>{trigger}</button>
      {open && <div ref={panel} className={`popover ${panelClass}`} style={place}>{children(() => setOpen(false))}</div>}
    </>
  );
}

export function MenuItem({ icon, danger, onClick, href, children }: { icon: IconName; danger?: boolean; onClick?: () => void; href?: string; children: React.ReactNode }) {
  const cls = `menu__item${danger ? ' is-danger' : ''}`;
  return href
    ? <a className={cls} href={href} target="_blank" rel="noreferrer" onClick={onClick}><Icon name={icon} />{children}</a>
    : <button type="button" className={cls} onClick={onClick}><Icon name={icon} />{children}</button>;
}

export function Tabs<T extends string>({ label, value, onChange, tabs }: { label: string; value: T; onChange: (v: T) => void; tabs: [T, string, number][] }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map(([key, text, count]) => (
        <button key={key} type="button" role="tab" id={`tab-${key}`} aria-selected={value === key} onClick={() => onChange(key)}>{text}<span>{count}</span></button>
      ))}
    </div>
  );
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : page * PAGE + 1;
  return (
    <div className="pager">
      <span>Showing {from}–{Math.min(total, (page + 1) * PAGE)} of {total}</span>
      <div>
        <button type="button" className="btn" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn" disabled={(page + 1) * PAGE >= total} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

/**
 * "Upload" button: picks image files, shrinks each in the browser, sends it to the media
 * store, and reports the address of every photo that made it. Problems are shown beside it.
 */
export function UploadButton({ id, label, multiple = false, limit = 12, onUploaded }: { id: string; label: string; multiple?: boolean; limit?: number; onUploaded: (sources: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');

  const send = async (files: File[]) => {
    setProblem('');
    const done: string[] = [];
    const failed: string[] = [];
    for (const [i, file] of files.slice(0, limit).entries()) {
      setBusy(files.length > 1 ? `Uploading ${i + 1} of ${Math.min(files.length, limit)}…` : 'Uploading…');
      try {
        const res = await upload(await prepareImage(file));
        if (res.ok) done.push(res.data.src);
        else failed.push(`${file.name}: ${saveError(res.error)}`);
      } catch {
        failed.push(`${file.name}: this file is not a photo the browser can read.`);
      }
    }
    setBusy('');
    if (files.length > limit) failed.push(`Only ${limit} more ${limit === 1 ? 'photo fits' : 'photos fit'}; the rest were skipped.`);
    setProblem(failed.join(' '));
    if (done.length) onUploaded(done);
  };

  return (
    <>
      <input ref={input} id={`${id}-file`} className="sr" type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) void send(files); }} />
      <button type="button" id={id} className="btn" disabled={!!busy || limit <= 0} onClick={() => input.current?.click()}><Icon name="upload" />{busy || label}</button>
      {problem && <small className="field__error upload__error" role="alert">{problem}</small>}
    </>
  );
}

/**
 * A product's photos in order: the first one is the cover. Photos are uploaded from this
 * device, or added by address (a file the shop already serves under /media, or an https link).
 */
export function MediaEditor({ value, onChange, max = 12 }: { value: string[]; onChange: (next: string[]) => void; max?: number }) {
  const [url, setUrl] = useState('');
  const [byLink, setByLink] = useState(false);
  const text = url.trim();
  const room = max - value.length;
  const problem = !text ? '' : !isMediaSrc(text) ? 'Use an https:// link or a path that starts with /media/.' : value.includes(text) ? 'This photo is already in the list.' : '';
  const add = () => { if (text && !problem && room > 0) { onChange([...value, text]); setUrl(''); } };
  return (
    <>
      {value.length > 0 && (
        <ul className="media">
          {value.map((src, i) => (
            <li key={src}>
              <Thumb src={src} size={104} />
              {i === 0 ? <span>Cover</span> : <button type="button" className="media__cover" onClick={() => onChange([src, ...value.filter((x) => x !== src)])}>Make cover</button>}
              <button type="button" className="media__remove" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(value.filter((x) => x !== src))}><Icon name="x" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="media__actions">
        <UploadButton id="media-upload" label="Upload photos" multiple limit={room} onUploaded={(sources) => onChange([...value, ...sources.filter((x) => !value.includes(x))].slice(0, max))} />
        <button type="button" className="link link--plain" aria-expanded={byLink} onClick={() => setByLink((v) => !v)}>{byLink ? 'Hide link field' : 'Add by link instead'}</button>
      </div>
      {byLink && (
        <div className="media__add">
          <label className="field">Photo link
            <input id="media-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or /media/products/…" maxLength={500} aria-invalid={!!problem}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} disabled={room <= 0} />
          </label>
          <button type="button" id="media-add" className="btn" onClick={add} disabled={!text || !!problem || room <= 0}><Icon name="plus" />Add</button>
        </div>
      )}
      {byLink && problem && <small className="field__error">{problem}</small>}
      <p className="muted media__hint">{room <= 0 ? `A product can have up to ${max} photos.` : 'JPEG, PNG or WebP. Large photos are shrunk to 1600 px before they are sent.'}</p>
    </>
  );
}
