# Aurelle Cinematic Showroom v6 — Entrance

A luxury jewelry landing page with 12 scroll-driven 3D scenes. The journey moves through the diamond, gold setting, assembly, pavé details, gallery, silhouette and rotating ring showcase before the invitation to enter the store.

All hand scenes, hand geometry, textures, fitting motion and asynchronous hand loading have been removed. The first 12 ring poses are preserved and remapped across the complete scroll timeline. The final pose shows the complete ring.

GSAP ScrollTrigger uses `scrub: true`. Scrolling back restores the same camera and ring poses. Story length scales with the remaining scenes, so there is no empty scroll interval after the removal. The scene index, counter, navigation dots and ID/EN copy now have 12 entries. Reduced-motion mode, lightweight rendering and store navigation remain available.

The ring has 170 convex diamond facet planes, 68 pavé stones, 68 seats and 136 beads. Facet-intersection shaders approximate gemstone optics; gold uses a physical material with subtle polishing variation. Rendering happens on scroll and state changes.

## Loading entrance

A lightweight 4.2 KB bootstrap displays a black full-screen entrance with a white vector monogram, AURELLE wordmark and a subtle breathing diamond. It runs before the split Three.js/GSAP chunk is imported. Critical entrance styling is inline in the static document to cover the landing from its first paint.

The entrance waits for UI setup, document fonts and the rendered scene. The renderer precompiles the full ring materials using `compileAsync`, draws the initial scene, then signals readiness after two animation frames. The black panels open vertically in an 850 ms curtain transition. Reduced-motion mode opens immediately. There is no fake percentage or mandatory minimum loading delay.

While loading, the content is inert and scroll is locked. Focus is contained within the entrance, then restored to content. After 6 seconds a Continue without 3D button appears. A 12-second controller deadline opens a product-poster fallback. The static document has an independent 15-second watchdog for module loading failure and a no-JavaScript escape. The store link remains available in the entrance.

React integration uses the same entrance controller and disposes timers, locks and animation state on unmount. The preloader uses the new black/white identity; the rest of this demo still contains its existing ring/theme assets, pending the separate silver visual migration.

## React integration

Copy `src/`, `integrations/`, `dist/style.css` and `dist/ring-poster.png` into your project. Install `three` and `gsap` alongside React.

```tsx
import AurelleShowroom from './aurelle/integrations/AurelleShowroom';

export default function EntryPage(){
  return <AurelleShowroom storeUrl="/store" posterUrl="/ring-poster.png" />;
}
```

The wrapper disposes observers, ScrollTrigger and WebGL resources. Next.js consumers should use a client component. `store.html` is a category preview; set the store URL to your production store when integrating.

Run `npm install`, `npm run build`, `npm test`. Publish `dist/`. Runtime dependencies are bundled locally.

## Verification

Build, React TypeScript checks, desktop/mobile camera continuity, reverse-scroll determinism, convex gemstone geometry and pavé spacing checks pass. Readiness order, one-shot fallback, reduced motion, scroll/inert restoration, custom store URL, focus and unmount cleanup are checked with a DOM contract fixture; this is not a browser test. Browser QA is unavailable in this environment; full browser appearance and touch performance remain unverified.
