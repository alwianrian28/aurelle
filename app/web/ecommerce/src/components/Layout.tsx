import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import Footer from './Footer';
import { ScrollSmoother, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';
import { useOrderStore } from '../store/orderStore';
import ErrorBoundary from './ErrorBoundary';
import GuideDialogs from './GuideDialogs';
import { pullOrders } from '../lib/orderSync';
import { loadCatalog } from '../lib/catalogSync';

/** Rute transaksi tidak memakai smoothing agar input tidak tertunda (§14.3, baris "Alur transaksi" [U]). */
const NO_SMOOTH_PATTERN = /^\/(cart|checkout|auth|account)/;

/**
 * Layout publik — menyinkronkan bahasa dari prefiks URL (§5.1) dan memasang
 * ScrollSmoother (BR-29) kecuali saat reduced motion atau di rute transaksi.
 */
export default function Layout() {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.documentElement.lang = i18n.language.startsWith("id") ? "id" : "en"; }, [i18n.language]);
  const smoothEnabled = !NO_SMOOTH_PATTERN.test(location.pathname);
  /** Checkout renders its own slim bar and footer: no site navigation mid-purchase. */
  const bare = /^\/checkout\/?$/.test(location.pathname);

  useLayoutEffect(() => {
    if (!smoothEnabled || prefersReducedMotion() || !wrapperRef.current || !contentRef.current) {
      window.scrollTo(0, 0);
      return;
    }
    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      smooth: 1.1,
      effects: true,
      smoothTouch: false, // mobile: efek dikurangi (§14.3)
    });
    smoother.scrollTop(0);
    return () => {
      smoother.kill();
    };
  }, [location.pathname, smoothEnabled]);

  // Refresh ScrollTrigger setelah konten rute baru dirender.
  useEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(id);
  }, [location.pathname]);

  // Lepas reservasi yang kedaluwarsa (simulasi job backend, AC-08-04).
  useEffect(() => {
    useOrderStore.getState().expireStale();
  }, [location.pathname]);

  // Admin updates (status, tracking) and server stock reach the page on navigation and every 30 s.
  useEffect(() => {
    void pullOrders();
    void loadCatalog();
    const id = window.setInterval(() => { void pullOrders(); void loadCatalog(); }, 30_000);
    return () => window.clearInterval(id);
  }, [location.pathname]);


  return (
    <>
      <a className="skip-link" href="#main">
        {t('system.skip')}
      </a>
      {!bare && <Header />}
      <div id="smooth-wrapper" ref={wrapperRef}>
        <div id="smooth-content" ref={contentRef}>
          <main id="main" tabIndex={-1} style={{ paddingTop: bare ? 0 : 'var(--header-h)', outline: 'none' }}>
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
          {!bare && <Footer />}
        </div>
      </div>
      <GuideDialogs />
    </>
  );
}
