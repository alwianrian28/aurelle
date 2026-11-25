import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { flagUrl, type CountryChoice } from '../utils/countryChoices';
import './CountryPicker.css';

export function Flag({ iso }: { iso: string }) {
  const src = flagUrl(iso);
  return src ? <img className="country-flag" src={src} alt="" width={22} height={15} loading="lazy" /> : <span className="country-flag country-flag--none" aria-hidden="true" />;
}

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * A country dropdown with flags and a search box. `pinned` values are listed first, above a
 * line (the countries most customers pick). `compact` shows only the flag and the hint on the
 * button, for the phone number's country code.
 * Keyboard: type to search, arrows to move, Enter to choose, Escape to close.
 */
export default function CountryPicker({ id, labelledBy, describedBy, invalid, choices, pinned = [], value, onChange, placeholder, searchLabel, emptyLabel, compact = false }: {
  id: string; labelledBy: string; describedBy?: string; invalid?: boolean;
  choices: CountryChoice[]; pinned?: string[]; value: string; onChange: (value: string) => void;
  placeholder: string; searchLabel: string; emptyLabel: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = choices.find((c) => c.value === value);

  // Pinned first while browsing; a search looks through everything once.
  const rows = useMemo(() => {
    const q = plain(query.trim());
    // "62" or "+62" looks up a calling code; anything else looks in the names.
    const code = /^\+?\d+$/.test(q) ? q.replace('+', '') : null;
    if (q) return choices.filter((c) => (code ? (c.hint ?? '').replace('+', '').startsWith(code) : plain(c.label).includes(q) || c.iso.toLowerCase() === q));
    const top = pinned.map((p) => choices.find((c) => c.value === p)).filter((c): c is CountryChoice => !!c);
    return [...top, ...choices.filter((c) => !pinned.includes(c.value))];
  }, [choices, pinned, query]);
  const divider = query.trim() ? -1 : pinned.filter((p) => choices.some((c) => c.value === p)).length - 1;

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => { setQuery(''); setActive(Math.max(0, rows.findIndex((c) => c.value === value))); setOpen(true); };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const choose = (choice: CountryChoice) => { onChange(choice.value); close(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(rows.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[active]) choose(rows[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`country-picker${compact ? ' country-picker--compact' : ''}${open ? ' is-open' : ''}`} ref={root}>
      <button
        ref={trigger} id={id} type="button" className="country-picker__button" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelledBy} ${id}`} aria-describedby={describedBy} aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show(); } }}
      >
        {selected ? <><Flag iso={selected.iso} /><span className="country-picker__value">{compact ? selected.hint : selected.label}</span></> : <span className="country-picker__value is-empty">{placeholder}</span>}
        <svg className="country-picker__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="country-picker__panel">
          <div className="country-picker__search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></svg>
            <input
              ref={search} type="text" value={query} placeholder={searchLabel} aria-label={searchLabel} autoComplete="off" spellCheck={false}
              role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKey}
            />
          </div>
          <ul ref={list} id={listId} role="listbox" aria-labelledby={labelledBy}>
            {rows.map((choice, i) => (
              <li
                key={choice.value} id={`${listId}-${i}`} role="option" aria-selected={choice.value === value} data-active={i === active}
                className={i === divider ? 'has-divider' : undefined}
                onPointerMove={() => setActive(i)} onClick={() => choose(choice)}
              >
                <Flag iso={choice.iso} /><span className="country-picker__name">{choice.label}</span>{choice.hint && <span className="country-picker__hint">{choice.hint}</span>}
              </li>
            ))}
            {rows.length === 0 && <li className="country-picker__empty" role="presentation">{emptyLabel}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
