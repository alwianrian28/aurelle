import { Suspense, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import JewelModel, { type JewelShape } from './JewelModel';
import StudioEnvironment from './StudioEnvironment';
import './JewelViewer.css';

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

interface JewelViewerProps {
  shape: JewelShape;
  posterSrc?: string;
  posterAlt?: string;
  autoRotate?: boolean;
  className?: string;
}

/**
 * Viewer 3D produk unggulan — §14.4.
 * - Interaksi dikendalikan pengguna: rotate, zoom, reset (NFR-A-03).
 * - Lazy load dengan poster + fallback foto saat gagal (FR-04, §14.4).
 * - Pembelian tidak boleh bergantung pada 3D: seluruh data harga/CTA berada di luar canvas ini.
 */
export default function JewelViewer({ shape, posterSrc, posterAlt, autoRotate = false, className }: JewelViewerProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  if (failed) {
    return (
      <div className={`jewel-viewer jewel-viewer--fallback ${className ?? ''}`}>
        {posterSrc ? (
          <img src={posterSrc} alt={posterAlt ?? ''} />
        ) : (
          <div className="jewel-viewer__placeholder" aria-hidden="true" />
        )}
      </div>
    );
  }

  return (
    <div className={`jewel-viewer ${className ?? ''}`}>
      {!active && (
        <button
          className="jewel-viewer__poster"
          onClick={() => setActive(true)}
          aria-label={t('viewer.openAria')}
        >
          {posterSrc ? <img src={posterSrc} alt={posterAlt ?? ''} /> : <div className="jewel-viewer__placeholder" />}
          <span className="jewel-viewer__cta">
            <Spin3dIcon /> {t('viewer.open')}
          </span>
        </button>
      )}

      {active && (
        <div className="jewel-viewer__canvas-wrap">
          <Suspense fallback={<div className="jewel-viewer__loading">{t('viewer.loading')}</div>}>
            <Canvas
              shadows
              dpr={[1, 1.8]}
              camera={{ position: [0, 0.4, 3.2], fov: 38 }}
              onError={() => setFailed(true)}
            >
              <ambientLight intensity={0.5} />
              <directionalLight position={[3, 4, 2]} intensity={1.4} castShadow />
              <StudioEnvironment />
              <group scale={1.15}>
                <JewelModel shape={shape} />
              </group>
              <ContactShadows position={[0, -1.3, 0]} opacity={0.35} blur={2.4} far={3} />
              <OrbitControls
                ref={controlsRef}
                enablePan={false}
                minDistance={1.8}
                maxDistance={5}
                autoRotate={autoRotate}
                autoRotateSpeed={1.1}
              />
            </Canvas>
          </Suspense>

          <div className="jewel-viewer__controls" role="group" aria-label={t('viewer.controls')}>
            <button onClick={() => controlsRef.current?.reset()} aria-label={t('viewer.reset')}>
              <ResetIcon />
            </button>
            <button
              onClick={() => {
                const c = controlsRef.current;
                if (c) c.dollyIn(1.15);
              }}
              aria-label={t('viewer.zoomIn')}
            >
              +
            </button>
            <button
              onClick={() => {
                const c = controlsRef.current;
                if (c) c.dollyOut(1.15);
              }}
              aria-label={t('viewer.zoomOut')}
            >
              −
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Spin3dIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="12" rx="9" ry="4.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12a8 8 0 1 1 2.6 5.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 17v-5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
