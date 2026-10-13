import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import JewelModel, { type JewelShape } from '../components/three/JewelModel';
import { METAL_TONES } from '../components/three/tones';
import StudioEnvironment from '../components/three/StudioEnvironment';

/**
 * DEV-ONLY studio render — dipakai skrip untuk membuat render produk sementara
 * (public/media/*) dari model prosedural, sampai foto produk resmi tersedia.
 * Tidak terdaftar di build produksi.
 */
const BACKDROPS: Record<string, string> = {
  ivory: 'radial-gradient(90% 80% at 50% 35%, #ffffff 0%, #edf0f5 60%, #dce1e8 100%)',
  champagne: 'radial-gradient(90% 80% at 50% 35%, #ffffff 0%, #dce1e8 60%, #a5aeba 100%)',
  noir: 'radial-gradient(90% 80% at 50% 35%, #353e4b 0%, #191e26 60%, #0e1116 100%)',
  blush: 'radial-gradient(90% 80% at 50% 35%, #ffffff 0%, #edf0f5 60%, #dce1e8 100%)',
};

function Ready() {
  const [frames, setFrames] = useState(0);
  useFrame(() => {
    if (frames < 30) setFrames((f) => f + 1);
  });
  useEffect(() => {
    if (frames >= 30) document.title = 'READY';
  }, [frames]);
  return null;
}

export default function RenderStudio() {
  const [params] = useSearchParams();
  const shape = (params.get('shape') ?? 'ring') as JewelShape;
  const tone = METAL_TONES[(params.get('tone') ?? 'silver') as keyof typeof METAL_TONES] ?? METAL_TONES.silver;
  const gem = params.get('gem') ?? undefined;
  const bg = params.get('bg') ?? 'ivory';
  const rx = Number(params.get('rx') ?? 0.35);
  const ry = Number(params.get('ry') ?? -0.5);
  const rz = Number(params.get('rz') ?? 0);
  const dist = Number(params.get('dist') ?? 4.2);
  const y = Number(params.get('y') ?? 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: BACKDROPS[bg] ?? BACKDROPS.ivory, zIndex: 9999 }}>
      <Canvas dpr={1} camera={{ position: [0, 0.25, dist], fov: 32 }} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} />
        <StudioEnvironment mood={bg === 'noir' ? 'noir' : 'ivory'} />
        <group rotation={[rx, ry, rz]} position={[0, y, 0]}>
          <JewelModel shape={shape} tone={tone} gem={gem} />
        </group>
        <ContactShadows position={[0, -1.4, 0]} opacity={bg === 'noir' ? 0.6 : 0.35} blur={2.6} scale={7} far={3.2} color={bg === 'noir' ? '#000000' : '#555f6d'} />
        <Ready />
      </Canvas>
    </div>
  );
}
