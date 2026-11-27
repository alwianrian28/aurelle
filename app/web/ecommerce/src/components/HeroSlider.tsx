import { useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react';
import type { I18nText } from '../types/domain';
import { useLocalized } from '../hooks/useLocale';
import './HeroSlider.css';

export interface HeroSlide {
  src: string;
  alt: I18nText;
  /** CSS object-position, so the jewelry stays in frame on every viewport. */
  position?: string;
}

const INTERVAL_MS = 4000;
const SWIPE_THRESHOLD_PX = 50;

/**
 * Background carousel for the storefront hero: advances every 4 s and can be swiped
 * (touch or mouse drag). `children` renders the overlay for the active slide.
 * Rotation holds while keyboard focus is inside, and never starts for reduced-motion users.
 */
export default function HeroSlider({ slides, children }: {
  slides: HeroSlide[];
  children?: (index: number) => ReactNode;
}) {
  const text = useLocalized();
  const count = slides.length;
  // Unbounded position: it only ever steps to a neighbour, so the last slide flows on into the
  // first instead of rewinding across the whole track. `index` is the slide it lands on.
  const [pos, setPos] = useState(0);
  const index = ((pos % count) + count) % count;
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [focused, setFocused] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const pointer = useRef<{ id: number; x: number } | null>(null);
  const autoplay = !reducedMotion && !focused && dragX === null && count > 1;

  /** Jump to slide `target` by the shorter way round. */
  const go = (target: number) => {
    const delta = (((target - index) % count) + count) % count;
    setPos(pos + (delta > count / 2 ? delta - count : delta));
  };

  // Re-armed on every slide change, so a manual swipe restarts the 4 s count.
  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => setPos(p => p + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, autoplay, count]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointer.current = { id: e.pointerId, x: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragX(0);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id === e.pointerId) setDragX(e.clientX - pointer.current.x);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id !== e.pointerId) return;
    const dx = e.clientX - pointer.current.x;
    pointer.current = null;
    setDragX(null);
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) setPos(pos + (dx < 0 ? 1 : -1));
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  };

  return (
    <div
      className="hero-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label={text({ id: 'Sorotan koleksi', en: 'Collection highlights' })}
      // Keyboard focus only: a mouse click on the CTA must not freeze the rotation.
      onFocus={e => setFocused(e.target.matches(':focus-visible'))}
      onBlur={onBlur}
    >
      <div
        className={`hero-slider__track${dragX !== null ? ' is-dragging' : ''}`}
        style={{ transform: `translateX(calc(${-pos * 100}% + ${dragX ?? 0}px))` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className="hero-slider__slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            aria-hidden={i !== index}
            // Each slide sits at its copy nearest the current position, so both neighbours always exist.
            style={{ transform: `translateX(${(i + count * Math.round((pos - i) / count)) * 100}%)` }}
          >
            <img
              src={slide.src}
              alt={text(slide.alt)}
              style={{ objectPosition: slide.position }}
              draggable={false}
              decoding="async"
              fetchPriority={i === 0 ? 'high' : 'low'}
            />
          </div>
        ))}
      </div>

      {children?.(index)}

      {count > 1 && (
        <div className="hero-slider__dots">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              id={`hero-slide-${i + 1}`}
              className={`hero-slider__dot${i === index ? ' is-active' : ''}${autoplay ? '' : ' is-paused'}`}
              aria-label={text({ id: 'Tampilkan foto {n} dari {count}', en: 'Show photo {n} of {count}' }).replace('{n}', String(i + 1)).replace('{count}', String(count))}
              aria-current={i === index}
              onClick={() => go(i)}
            >
              <span key={i === index ? index : undefined} style={{ animationDuration: `${INTERVAL_MS}ms` }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
