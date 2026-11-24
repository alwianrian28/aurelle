import { Environment, Lightformer } from '@react-three/drei';

/**
 * Environment studio lokal (tanpa unduhan HDR eksternal).
 * Latar studio netral + softbox terang memberi kontras yang dibutuhkan logam agar terbaca
 * sebagai silver dengan pantulan terang/gelap, tetap ringan (NFR-P-02).
 */
export default function StudioEnvironment({ mood = 'ivory' }: { mood?: 'ivory' | 'noir' }) {
  const base = mood === 'noir' ? '#191e26' : '#737b85';
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={[base]} />
      {/* Softbox atas besar */}
      <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 5, -2]} rotation-x={Math.PI / 2} scale={[8, 6, 1]} />
      {/* Strip kiri & kanan untuk garis highlight panjang pada band */}
      <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[1.2, 7, 1]} />
      <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[1.2, 7, 1]} />
      {/* Fill depan lembut */}
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 1, 6]} scale={[5, 2.5, 1]} />
      {/* Bounce netral dari bawah */}
      <Lightformer form="rect" intensity={1.2} color="#c9cdd2" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[8, 8, 1]} />
      {/* Aksen kecil untuk kilau batu */}
      <Lightformer form="circle" intensity={8} color="#ffffff" position={[2, 3, 3]} scale={0.6} />
      <Lightformer form="circle" intensity={6} color="#ffffff" position={[-2.5, 2, 3]} scale={0.4} />
    </Environment>
  );
}
