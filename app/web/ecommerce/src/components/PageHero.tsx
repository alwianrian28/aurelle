import type { ReactNode } from 'react';
import './PageHero.css';

interface PageHeroProps {
  eyebrow: string;
  title: string;
  intro?: string;
  /** Visual pendukung (render sementara; diganti foto resmi brand). */
  image?: string;
  /** Konten tambahan di bawah intro (CTA, breadcrumbs, meta). */
  children?: ReactNode;
  /** `compact` untuk halaman utilitarian (kebijakan, FAQ) — tanpa visual besar. */
  variant?: 'split' | 'compact';
  id?: string;
}

/**
 * Hero editorial yang konsisten untuk halaman sekunder (Shop, F-19 informasi).
 * Gambar bersifat dekoratif (alt kosong) karena judul sudah menjelaskan konteks halaman.
 */
export default function PageHero({ eyebrow, title, intro, image, children, variant = 'split', id }: PageHeroProps) {
  const hasVisual = variant === 'split' && !!image;
  return (
    <header id={id} className={`page-hero page-hero--${hasVisual ? 'split' : 'compact'}`}>
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="heading-xl">{title}</h1>
        {intro && <p className="page-hero__intro">{intro}</p>}
        {children && <div className="page-hero__extra">{children}</div>}
      </div>
      {hasVisual && (
        <div className="page-hero__visual" aria-hidden="true">
          <img src={image} alt="" loading="eager" />
          <span className="page-hero__ring" />
        </div>
      )}
    </header>
  );
}
