import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../hooks/useLocale';
import { useAuthStore } from '../store/authStore';
import { useWishlistStore } from '../store/wishlistStore';
import Icon from './ServiceIcons';
import './WishlistButton.css';

const BEAT_GIF = '/media/icons/heart-beat.gif';
const BEAT_MS = 2000; // one full run of the GIF
const FILLED = '/media/icons/heart-filled.png'; // the GIF's resting frame

/**
 * Fetched once. Each play gets its own object URL, because browsers do not reliably
 * restart an already-cached animated GIF from its first frame.
 */
let beatBlob: Promise<Blob> | null = null;
const loadBeat = () => (beatBlob ??= fetch(BEAT_GIF).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('heart gif')))));

/**
 * Wishlist toggle (F-05; login required, FR-05-02). Adding a product plays the heart-beat
 * GIF once, then rests on the filled heart. Removing shows the outline immediately.
 */
export default function WishlistButton({ productId, className = '', size = 18 }: { productId: string; className?: string; size?: number }) {
  const { t } = useTranslation();
  const path = useLocalePath();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wished = useWishlistStore((s) => s.productIds.includes(productId));
  const toggle = useWishlistStore((s) => s.toggle);
  const [beat, setBeat] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const stop = () => {
    window.clearTimeout(timer.current);
    setBeat((url) => { if (url) URL.revokeObjectURL(url); return null; });
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = (e: MouseEvent) => {
    e.preventDefault(); // the card itself is a link
    if (!isAuthenticated) {
      // FR-05-02: wishlist needs login; return to this page afterwards (FR-01-08).
      navigate(path('/auth/login'), { state: { from: location.pathname } });
      return;
    }
    toggle(productId);
    stop();
    if (wished || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    loadBeat().then((blob) => {
      setBeat(URL.createObjectURL(blob));
      timer.current = window.setTimeout(stop, BEAT_MS);
    }).catch(() => { /* static filled heart is already showing */ });
  };

  return (
    <button
      type="button"
      className={`wish-btn ${className}${wished ? ' is-active' : ''}`}
      onClick={onClick}
      aria-label={t('common.wishlist')}
      aria-pressed={wished}
    >
      {wished
        // A background, not an <img>: card media styles target every img inside the photo frame.
        ? <span className="wish-btn__heart" aria-hidden="true" style={{ width: size + 4, height: size + 4, backgroundImage: `url(${beat ?? FILLED})` }} />
        : <Icon name="heart" size={size} />}
    </button>
  );
}
