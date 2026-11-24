import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import './SortMenu.css';

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Compact sort dropdown (menu button + radio items). A native <select> cannot style its
 * open list, so this keeps the storefront's typography in both states.
 * Keyboard: Enter/Space/↓ opens, ↑/↓/Home/End move, Esc or Tab closes.
 */
export default function SortMenu<T extends string>({ label, value, options, onChange, id }: {
  label: string;
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
  id?: string;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    items.current[Math.max(0, options.findIndex(o => o.value === value))]?.focus();
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, options, value]);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = items.current.findIndex(item => item === document.activeElement);
    const focus = (i: number) => items.current[(i + options.length) % options.length]?.focus();
    if (e.key === 'ArrowDown') { e.preventDefault(); focus(index + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focus(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focus(0); }
    else if (e.key === 'End') { e.preventDefault(); focus(options.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`sort-menu${open ? ' is-open' : ''}`} ref={root}>
      {/* Plain text: only the current value opens the menu. */}
      <span className="sort-menu__label" aria-hidden="true">{label}</span>
      <button
        ref={trigger}
        id={id}
        type="button"
        className="sort-menu__trigger"
        aria-label={`${label}: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}
      >
        <span className="sort-menu__value">{current.label}</span>
        <svg className="sort-menu__chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <div id={menuId} className="sort-menu__panel" role="menu" aria-label={label} hidden={!open} onKeyDown={onMenuKey}>
        {options.map((option, i) => (
          <button
            key={option.value}
            ref={el => { items.current[i] = el; }}
            type="button"
            role="menuitemradio"
            aria-checked={option.value === value}
            tabIndex={-1}
            className="sort-menu__item"
            onClick={() => choose(option.value)}
          >
            {option.label}
            <svg width="12" height="9" viewBox="0 0 12 9" aria-hidden="true">
              <path d="M1 4.5l3.2 3L11 1" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
