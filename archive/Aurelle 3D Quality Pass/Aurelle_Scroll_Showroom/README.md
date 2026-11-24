# Aurelle Cinematic Showroom v6

A luxury jewellery entrance page with 12 scroll-driven 3D scenes (no hands, no figures). One ring, one continuous camera and object timeline, then **Masuk ke Store / Enter the Store**. v6 is a rendering-quality pass: geometry, optics, gold, studio lighting, lens and colour pipeline.

## Setup

```bash
npm install
npm test          # continuity, reversibility, cut geometry, pavé seating, claw contact
npm run typecheck # React wrapper + declarations
npm run build     # bundles src/main.js -> dist/app.js
```

Publish `dist/` (`index.html`, `app.js`, `style.css`, `ring-poster.png`, plus your `store.html`).

For an unbundled preview, serve the project root and open `Aurelle Showroom.html`, which loads `src/` through an import map (three 0.184 / GSAP 3.13 from CDN). `Before v5.html` runs the untouched v5 source with the same stylesheet for side-by-side comparison. `Tests.html` runs `tests/motion.test.mjs` in a browser.

## React

Copy `src/`, `integrations/`, `dist/style.css`, `dist/ring-poster.png`; install `three` and `gsap`.

```tsx
import AurelleShowroom from './aurelle/integrations/AurelleShowroom';
export default function EntryPage(){ return <AurelleShowroom storeUrl="/store" posterUrl="/ring-poster.png" />; }
```

Use it as a client component in Next.js. Unmount disposes ScrollTrigger, observers, geometries, materials, the studio texture, the PMREM target and the renderer.

## Quality modes

| Mode | Centre stone | Pavé | Loose stones | Pixel ratio |
| --- | --- | --- | --- | --- |
| High (desktop) | 8 bounces, dispersion | 3 bounces, dispersion | 3 bounces | ≤ 2 |
| High (< 760 px) | 5 bounces, dispersion | 2 bounces | 2 bounces | ≤ 1.5 |
| Light mode | 3 bounces, no dispersion | 1 bounce | 1 bounce | 1 |
| Shader failure | `MeshPhysicalMaterial` transmission fallback | same | same | unchanged |

Reduced motion shows the final product view with working CTA and scene navigation. If WebGL is unavailable, the poster and a status message are shown.

## What changed in v6

**Diagnosis of v5 (from source).** The centre stone was a convex hull of six vertex rings: total depth ≈ 79 % of width (real ovals ≈ 58–63 %), crown ≈ 27 % (≈ 15 %), 16-point pavilion folding into an 8-point culet ring, no bezel/star/half-facet structure. The studio map was mostly 0.1–0.3 grey, so facets read grey. Pavé stones were 122 % deep, sitting on torus "donut" seats. The band had duplicated seam vertices (normal seam) and a sin-based roughness pattern that aliased at distance. Lights were punctual game lights plus a contact shadow floating 0.26 units below the ring. ACES tone mapping shifted the gold toward orange.

**Geometry.** One scale (1 unit ≈ 8.6 mm). The cut is now an intersection of 90 facet planes (table, 8 stars, 8 bezels, 16 upper halves, 32 girdle, 16 lower halves, 8 pavilion mains, culet), stretched to a 1.38 oval; the same planes drive the mesh and the shader. Band: superellipse cross-section, comfort-fit inner dome, tapers 1.8 → 2.6 mm wide and 1.25 → 1.6 mm thick, welded (no seams), with a bright-cut pavé channel on both shoulders. Head: four tapered claws with rounded tips that overlap the girdle by ≈ 0.05 mm (grip), an under-girdle rail and a lower gallery rail, all clear of the pavilion (tested). Pavé: 68 correctly proportioned round brilliants seated on the channel floor, 144 beads (four per stone), bevelled seat lips.

**Optics.** Entrance Fresnel, refraction at n = 2.4175, exact dielectric Fresnel + TIR on every internal hit, per-channel exit refraction at the C/D/F indices (2.410 / 2.4175 / 2.435) for restrained fire, epsilon scaled to stone size, leftover energy credited with the studio's mean radiance (no glow constant). Light leaving the pavilion of a seated stone picks up a gold "seat" reflection. The studio is sampled with `textureLod` from a box-filtered mip chain chosen by the stone's screen size, so small stones do not shimmer while scrolling.

**Gold.** Metal F0 set in linear space (0.98, 0.75, 0.50), roughness 0.06 outside, slightly rougher inner shank, rougher seats; polishing lines along the shank that fade by screen footprint (no aliasing); analytic occlusion under the head.

**Lighting and colour.** One procedural HDR studio (key softbox, three strip lights, overhead dome, two pin lights, five black flags) lights both gold (PMREM) and diamonds (direct lookups). No punctual lights, no fake contact shadow. Linear shading, Khronos PBR Neutral tone mapping, sRGB output, each applied once (the custom shader uses the standard tonemapping/colorspace chunks).

**Camera.** Shots authored at 34° now render through a 24° desktop / 27° mobile lens at proportionally greater distance: same framing, less distortion. The pavé shot was re-targeted onto the new channel. Loose-stone density in scenes 1–2 was reduced so stones don't collide with the masthead. All motion remains a pure function of scroll progress.

**Post-processing.** None. Bloom/DOF were evaluated against the transparent-canvas compositing and frame budget and left out; the UI remains plain DOM.

## v6.1

- Scenes 11–12 follow the supplied macro reference in reverse: scene 11 is a girdle-level macro of a claw gripping the stone; scroll then lifts and turns the ring until scene 12 ends on the face-up diamond POV (table toward camera, band running vertically behind). Still one ring, one deterministic scroll timeline.
- Gold F0 moved to linear (1.0, 0.83, 0.50) and the studio's lower hemisphere and bounce card were brightened and neutralised, so midtones read as yellow gold rather than bronze/brown.

## v6.2

- Gold uses the client spec: `MeshPhysicalMaterial({color:0xD4AF37, metalness:1, roughness:0.12, clearcoat:0})`, with the existing subtle polish variation on top. The stone's internal gold-seat term uses the linear equivalent of #D4AF37.
- Scene 12 ends with the camera inside the face-up diamond POV, filling the viewport as the transition into the store section. Scene copy fades out over the last half-chapter so it doesn't sit on the facets.
- Reduced motion now rests on the full-ring view (scene 10) instead of the full-screen macro.

## v6.3 (client reference photo)

- Head rebuilt as a crossover/bypass setting: four strands grow out of the band edges, cross in an X in front of and behind the pavilion, and taper into slender claws gripping the girdle. Gallery rails removed. Tested: claw grip, strand-to-strand clearance.
- Gold colour #F3BF4C (MeshPhysicalMaterial, metalness 1, roughness 0.12, clearcoat 0), sampled from the reference. The studio was made darker and warm-amber with larger softboxes, so the gold gets the reference's contrast: bright warm highlights against deep reflections.

## v6.4

- Crossover head reshaped to the reference curve: each shoulder splits into front/back strands that root just past the pavé, rise in an S-curve and cross in a high X directly under the pavilion, then taper (Ø 0.86 → 0.31 mm) into hooked claws. Pavé kept (68 stones), shifted down the shoulders to make room for the strand roots.
- Gold #F6D27C (≈ 18k yellow-gold reflectance) with a brighter, near-neutral warm-white studio, so reflections read as bright gold instead of dark brown.

## v6.5

- Pavé stones that sat under the crossover strand roots were removed: 14 per row (56 stones, 120 beads), starting just past the roots so the strands and stones no longer overlap. A new test checks every stone and bead clears all four strands.

## v6.6

- Metal changed to an elegant silver finish: rhodium-plated white gold #E4E5E8, metalness 1, roughness 0.10 (variable `goldMaterial` kept for API compatibility). Scene 4 copy now reads "white gold / emas putih".
- Setting rebuilt for realism: strands start buried in the shank and rise out of the band as raised ridges (no floating gap, no visible cut ends); the X rests on the band; claws taper ≈1.1 → 0.6 mm (were 0.3 mm wire) and hook over the crown; an under-girdle rail ties the claws together. Tests: claw grip, strand clearance, rail clears pavilion, pavé clears strands.

## v7 — black edition

- Black page (#0B0A09) with a procedural black-silk drape under the ring: analytic sine folds in the vertex shader (exact normals), sheen material lit by the same studio, folds flow only with scroll, edges blend into the page black after tone mapping.
- Minimal UI: A monogram (cropped from the client logo to `dist/aurelle-monogram.png`) with "AURELLE · LUXURY JEWELRY" orbiting on an SVG text path (CSS rotation, stopped under reduced motion). Top-right: two-line underlined "Masuk ke / Store" in the display face, then "Jelajahi adegan" and ID / EN. Right rail: progress line, scene number 01–12, remaining line, total, SCROLL, arrow. Scene label, dots, counter bar and vertical note removed; light/reduced-motion toggles moved into the scene index.
- Type: display `ambroise-francois-std` (Adobe Fonts; set `data-typekit="<kit id>"` on #aurelle, or `typekitId` on the React component) with Bodoni Moda fallback; UI in Archivo Expanded.
- New React props: `assetBase` (folder holding `aurelle-monogram.png`), `typekitId`. Poster re-rendered on black.

## v7.1 — contrast fix

- The bright, flat studio tuned for yellow gold (v6.4) made silver and diamonds reflect an even grey: flat metal, milky facets. Studio walls are now dark for the stones (facet contrast) while the metal gets the same softboxes/flags with brighter walls (`makeStudioMap({surround:3.2})` → PMREM), like white cards on a product set.

## v7.2 — back to ivory

- Returned to the v6.6 look the client preferred: ivory page, single bright studio for metal and stones (v6.6 values), no silk drape. The v7 UI (orbiting A monogram, two-line Store link, right rail 01–12, minimal copy) is kept, recoloured charcoal on ivory; the white monogram PNG is darkened with a CSS filter. Poster re-rendered on ivory.

## v7.3 — silver studio backdrop

- `.backdrop` layer behind the canvas: cool pearl sweep, soft white light disc behind the piece, two hairline orbits (one with a small gold point), a honed tabletop horizon with a sheen, and fine paper grain. All of it shifts slightly with scroll via `--progress`; nothing animates on its own.

## v8 — silver identity

- Tokens in `dist/style.css`: Graphite #0E1116 (hero), Charcoal #191E26 (panels), Pearl #F5F7FA, Pure Black #000 (footer), White #FFF, Mist #A5AEBA, Platinum #B8C1CC (decor only), Dark Ink #151922, dividers #353E4B / #DCE1E8. All gold/champagne/warm accents removed from the UI.
- Hero: two ornament families only: a soft charcoal→graphite radial spotlight behind the ring, and original brilliant-cut facet linework (1 px, 4.5–6 % opacity) bleeding off the bottom-left and top-right corners. Both move slightly with scroll only. Mobile keeps the spotlight plus one smaller facet.
- Invitation: graphite→charcoal gradient continuing the showroom, with a large incomplete ring contour (7 %); primary CTA white/Dark Ink, secondary "replay" transparent with platinum border; black footer.
- White monogram used as-is on dark. `<html>` background and theme-color set to graphite to avoid a light flash before load. The WebGL canvas stays transparent, so the 3D model and optics are unchanged.
- Poster fallback (`dist/ring-poster.png`) is still the ivory render; re-render on graphite before shipping.

## v8.1 — diamond realism

- Dispersion uses measured diamond indices (2.4076 / 2.4237 / 2.4513 at 650 / 550 / 450 nm, B–G ≈ 0.044); v6 had about half the real fire.
- Stones trace their own studio variant: same softboxes and flags, walls at 55 %, flags 99.5 % black, plus 18 small hard pin lights. Facets now break into crisp black/white contrast with point scintillation, as in diamond photography. Metal keeps the bright studio unchanged.
- Centre stone bounces 8 → 10 (desktop), 5 → 6 (mobile).

## v8.2 — silver lighting

- Pale-grey areas on the band were reflections of the studio's mid-grey walls. Metal now uses `makeStudioMap({surround:.38, metal:true})`: walls at 38 %, flags 98.5 % black, plus `METAL_STRIPS` (tall strips either side of the camera, overhead strip, low front card, floor bounce, two back rims). The band shows white highlights against deep reflections, with no flat grey.

## v8.3 — crisp silver

- Remaining flat grey came from roughness 0.10 blurring the studio into smooth gradients, plus the rougher pavé seats (0.22). Metal roughness is now 0.045 (seats 0.10), metal PMREM at 2048 px, walls at 20 %, and `METAL_STRIPS` are thin paired strips, so polished silver shows several crisp highlight lines with dark gaps. Polish micro-variation amplitude raised slightly (still footprint-faded, no shimmer).

## v8.4 — no flat grey on close-ups (scenes 4–10)

- Cause: the studio's uniform overhead dome and the two broad softboxes. Up-facing band surfaces mirrored them as one flat light-grey tone. In the metal studio the dome is cut to 12 % and replaced by four banded ceiling strips; large softboxes get a diffuser falloff (bright core, dim edges); two soft graded side cards lift the shank sides. Diamond studio unchanged.

## v8.3 — no flat grey on the metal

- Flat pale-grey patches (scenes 4–10) came from even-toned studio walls and the uniform overhead dome mirrored by polished metal. The metal studio now has graded walls (slow luminance modulation), a banded ceiling instead of the dome, paired thin strips with dark gaps, and two large diffused walls behind/below the camera with real falloff. Silver reads as a gradient with crisp highlight lines in every shot. Silver roughness 0.045 with subtle micro-variation.

## Publishing build

`Aurelle Showroom.html` is self-contained for strict hosts: three.js r184 and GSAP 3.13 (copied to `vendor/`) plus the `src/` modules are embedded as text and linked through a runtime import map of blob URLs; the monogram and poster are declared as `ext-resource-dependency` and read from `window.__resources`. It is generated from `src/`; after editing `src/`, regenerate it. `Aurelle Showroom -dev-.html` is the unbundled CDN harness.

## Known limits (honest)

- Stone optics are environment-only. Neighbouring prongs, other stones, caustics and true occlusion are not traced; the seat term is an approximation. This is not full-scene path tracing.
- The convex tracer handles the stone's own facets exactly. Ray paths that exceed the bounce budget are approximated by the studio mean.
- Performance was not measured on physical devices. Visual checks were done in a desktop browser preview only; mobile framing logic is in place but was not checked on a real portrait device.
- `npm run build` / `tsc` were not executed in this environment; the test file was executed in a browser with a minimal `node:assert` shim (`tests/browser/assert-shim.js`) and passes.
- `store.html` is not part of this package (category preview from your existing deployment).
- `root.aurellePreview.show(p)` is a small QA hook used for screenshots; remove it if undesired.
