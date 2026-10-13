# Aurelle Cinematic Showroom v5

A luxury jewelry landing page with 12 scroll-driven 3D scenes. The journey moves through the diamond, gold setting, assembly, pavé details, gallery, silhouette and rotating ring showcase before the invitation to enter the store.

All hand scenes, hand geometry, textures, fitting motion and asynchronous hand loading have been removed. The first 12 ring poses are preserved and remapped across the complete scroll timeline. The final pose shows the complete ring.

GSAP ScrollTrigger uses `scrub: true`. Scrolling back restores the same camera and ring poses. Story length scales with the remaining scenes, so there is no empty scroll interval after the removal. The scene index, counter, navigation dots and ID/EN copy now have 12 entries. Reduced-motion mode, lightweight rendering and store navigation remain available.

The ring has 170 convex diamond facet planes, 68 pavé stones, 68 seats and 136 beads. Facet-intersection shaders approximate gemstone optics; gold uses a physical material with subtle polishing variation. Rendering happens on scroll and state changes.

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

Build, React TypeScript checks, desktop/mobile camera continuity, reverse-scroll determinism, convex gemstone geometry and pavé spacing checks pass. Browser QA is unavailable in this environment; full browser appearance and touch performance remain unverified.
