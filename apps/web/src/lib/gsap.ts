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

export { gsap, ScrollTrigger, ScrollSmoother, SplitText };
