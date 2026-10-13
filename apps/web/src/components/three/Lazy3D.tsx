import { lazy, Suspense, type ComponentProps } from 'react';

/**
 * Pintu masuk lazy untuk komponen 3D — Three.js/R3F hanya diunduh saat dibutuhkan
 * sehingga tidak memblokir render konten utama (NFR-P-02).
 */
const HeroSceneImpl = lazy(() => import('./HeroScene'));
const JewelViewerImpl = lazy(() => import('./JewelViewer'));

export function LazyHeroScene(props: ComponentProps<typeof HeroSceneImpl>) {
  return (
    <Suspense fallback={<div className="home-hero__fallback" aria-hidden="true" />}>
      <HeroSceneImpl {...props} />
    </Suspense>
  );
}

export function LazyJewelViewer(props: ComponentProps<typeof JewelViewerImpl>) {
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-lg)', background: 'var(--grad-pearl)' }}
        />
      }
    >
      <JewelViewerImpl {...props} />
    </Suspense>
  );
}
