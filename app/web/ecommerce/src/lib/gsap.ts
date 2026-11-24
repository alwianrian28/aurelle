import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText } from 'gsap/SplitText';

/**
 * Registrasi plugin GSAP — PRD BR-29 [F]: animasi, ScrollTrigger, ScrollSmoother, SplitText.
 */
gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isMobileViewport = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

/**
 * Scroll the page to the top. ScrollSmoother owns the scroll position while it is active,
 * so a plain `window.scrollTo` is overridden on its next frame; go through it when present.
 */
export function scrollToTop(smooth = true): void {
  const smoother = ScrollSmoother.get();
  if (smoother) smoother.scrollTo(0, smooth);
  else window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

export { gsap, ScrollTrigger, ScrollSmoother, SplitText };
