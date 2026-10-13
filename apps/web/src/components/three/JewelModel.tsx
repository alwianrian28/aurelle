import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { METAL_TONES } from './tones';

/**
 * Model perhiasan prosedural — pratinjau ilustratif sampai model 3D produksi (GLB) tersedia.
 * Dibangun dari geometri primitif agar ringan dan tanpa aset eksternal.
 */

export type JewelShape = 'ring' | 'band' | 'bangle' | 'pendant' | 'hoop';


export function SilverMaterial({ tone = METAL_TONES.silver }: { tone?: string }) {
  return <meshPhysicalMaterial color={tone} metalness={1} roughness={0.14} envMapIntensity={1.15} />;
}

export function GemMaterial({ color = '#ffffff' }: { color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={0}
      roughness={0}
      transmission={1}
      thickness={0.6}
      ior={2.417}
      dispersion={0.044}
      envMapIntensity={1.6}
    />
  );
}

/** Brilliant berfaset (aproksimasi, bukan potongan bersertifikat). Normal datar menjaga kilau faset. */
function BrilliantStone({ color, scale = 1 }: { color?: string; scale?: number }) {
  const geometry = useMemo(() => {
    const rings = [
      { radius: 0.125, y: 0.12 },
      { radius: 0.24, y: 0.025 },
      { radius: 0.24, y: 0.01 },
      { radius: 0.012, y: -0.18 },
    ];
    const vertices: number[] = [];
    const count = 16;
    const point = (ring: number, i: number) => {
      const angle = ((i % count) * Math.PI * 2) / count;
      return [Math.cos(angle) * rings[ring].radius, rings[ring].y, Math.sin(angle) * rings[ring].radius];
    };
    const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
    for (let i = 0; i < count; i++) {
      triangle([0, rings[0].y, 0], point(0, i + 1), point(0, i));
      for (let r = 0; r < rings.length - 1; r++) {
        triangle(point(r, i), point(r, i + 1), point(r + 1, i));
        triangle(point(r, i + 1), point(r + 1, i + 1), point(r + 1, i));
      }
      triangle([0, rings[3].y, 0], point(3, i), point(3, i + 1));
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    result.computeVertexNormals();
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} scale={scale}>
      <GemMaterial color={color} />
    </mesh>
  );
}

interface PartProps {
  tone?: string;
  gem?: string;
}

/** Cincin solitaire: band tapered + setting prong + batu berfaset. */
function Ring({ tone, gem }: PartProps) {
  const prongs = useMemo(() => [0, 1, 2, 3].map((i) => (i / 4) * Math.PI * 2 + Math.PI / 4), []);
  return (
    <group>
      <mesh castShadow>
        <torusGeometry args={[1, 0.095, 64, 200]} />
        <SilverMaterial tone={tone} />
      </mesh>
      <group position={[0, 1.08, 0]}>
        <mesh position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.16, 0.1, 0.16, 40]} />
          <SilverMaterial tone={tone} />
        </mesh>
        {prongs.map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 0.17, 0.15, Math.sin(a) * 0.17]} rotation={[Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18]}>
            <cylinderGeometry args={[0.02, 0.028, 0.28, 12]} />
            <SilverMaterial tone={tone} />
          </mesh>
        ))}
        <group position={[0, 0.22, 0]}>
          <BrilliantStone color={gem} />
        </group>
      </group>
    </group>
  );
}

/** Cincin band twist tanpa batu (dua untai terpilin). */
function Band({ tone }: PartProps) {
  const strands = useMemo(
    () =>
      [0, Math.PI].map((phase) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 400; i++) {
          const t = (i / 400) * Math.PI * 2;
          const twist = t * 7 + phase;
          const r = 1 + Math.cos(twist) * 0.06;
          pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, Math.sin(twist) * 0.06));
        }
        return new THREE.CatmullRomCurve3(pts, true);
      }),
    [],
  );
  return (
    <group>
      {strands.map((curve, i) => (
        <mesh key={i} castShadow>
          <tubeGeometry args={[curve, 500, 0.065, 20, true]} />
          <SilverMaterial tone={tone} />
        </mesh>
      ))}
    </group>
  );
}

/** Gelang bangle dengan aksen tali tipis (twist) di sekelilingnya. */
function Bangle({ tone }: PartProps) {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 18;
    for (let i = 0; i <= 600; i++) {
      const t = (i / 600) * Math.PI * 2;
      const r = 1.2 + Math.cos(t * turns) * 0.07;
      pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t * turns) * 0.07, Math.sin(t) * r));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  }, []);
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <torusGeometry args={[1.2, 0.07, 48, 200]} />
        <SilverMaterial tone={tone} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 600, 0.025, 10, true]} />
        <SilverMaterial tone={METAL_TONES.polished} />
      </mesh>
    </group>
  );
}

/** Kalung pendant: rantai lengkung + liontin sculptural + batu oval. */
function Pendant({ tone, gem }: PartProps) {
  const chain = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const x = (t - 0.5) * 2.6;
      const y = 1.6 - Math.cosh((t - 0.5) * 2.3) * 0.9 + 0.9 - 1.1 * (1 - Math.abs(t - 0.5) * 2) ** 2 * 0.2;
      pts.push(new THREE.Vector3(x, y, 0));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);
  return (
    <group position={[0, -0.2, 0]}>
      <mesh>
        <tubeGeometry args={[chain, 160, 0.018, 8, false]} />
        <SilverMaterial tone={METAL_TONES.polished} />
      </mesh>
      <group position={[0, 0.25, 0]}>
        <mesh position={[0, 0.32, 0]}>
          <torusGeometry args={[0.07, 0.02, 16, 40]} />
          <SilverMaterial tone={tone} />
        </mesh>
        <mesh scale={[0.8, 1.1, 0.5]}>
          <torusGeometry args={[0.3, 0.05, 32, 96]} />
          <SilverMaterial tone={tone} />
        </mesh>
        <mesh scale={[0.6, 0.85, 0.42]}>
          <sphereGeometry args={[0.3, 48, 48]} />
          <GemMaterial color={gem} />
        </mesh>
      </group>
    </group>
  );
}

/** Anting hoop: lingkaran dengan mutiara kecil. */
function Hoop({ tone }: PartProps) {
  return (
    <group>
      <mesh castShadow>
        <torusGeometry args={[0.8, 0.06, 32, 140]} />
        <SilverMaterial tone={tone} />
      </mesh>
      <mesh position={[0, -0.8, 0]}>
        <sphereGeometry args={[0.16, 48, 48]} />
        <meshPhysicalMaterial color="#f6efe3" roughness={0.18} sheen={1} sheenColor="#f1d9b5" clearcoat={1} />
      </mesh>
    </group>
  );
}

export default function JewelModel({ shape, tone, gem }: { shape: JewelShape } & PartProps) {
  switch (shape) {
    case 'band':
      return <Band tone={tone} />;
    case 'bangle':
      return <Bangle tone={tone} />;
    case 'pendant':
      return <Pendant tone={tone} gem={gem} />;
    case 'hoop':
      return <Hoop tone={tone} />;
    case 'ring':
    default:
      return <Ring tone={tone} gem={gem} />;
  }
}
