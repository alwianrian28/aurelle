import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import JewelModel from './JewelModel';
import StudioEnvironment from './StudioEnvironment';
import { ScrollTrigger, prefersReducedMotion, isMobileViewport } from '../../lib/gsap';
import { poses } from '../../content/chapters';

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="home-hero__fallback" /> : this.props.children; }
}

function Scene({ progress }: { progress: React.RefObject<number> }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const step = Math.min(poses.length - 1, Math.max(0, progress.current * (poses.length - 1)));
    const index = Math.floor(step);
    const a = poses[index];
    const b = poses[Math.min(index + 1, poses.length - 1)];
    const t = step - index;
    const pose = a.map((value, i) => value + (b[i] - value) * t);
    group.current.rotation.set(pose[0], pose[1], pose[2]);
    group.current.scale.setScalar(pose[3]);
    group.current.position.y = pose[4];
  });
  return <group ref={group}><JewelModel shape="ring" /></group>;
}

export default function HeroScene({ triggerRef, chapterProgress }: {
  triggerRef?: React.RefObject<HTMLElement | null>;
  chapterProgress?: React.RefObject<number>;
}) {
  const localProgress = useRef(1);
  const progress = chapterProgress ?? localProgress;
  const [failed, setFailed] = useState(false);
  const still = prefersReducedMotion();
  useEffect(() => {
    if (!triggerRef?.current || chapterProgress || still) return;
    const st = ScrollTrigger.create({ trigger: triggerRef.current, start: 'top top', end: 'bottom top',
      onUpdate: (self) => { progress.current = self.progress; } });
    return () => st.kill();
  }, [triggerRef, chapterProgress, still, progress]);
  if (failed || still) return <div className="home-hero__fallback" />;
  return (
    <SceneBoundary>
      <Canvas dpr={[1, isMobileViewport() ? 1 : 1.5]} camera={{ position: [0, .2, 5.8], fov: 34 }}
        onError={() => setFailed(true)} gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setFailed(true), { once: true }); }}>
        <ambientLight intensity={.3} />
        <StudioEnvironment mood="noir" />
        <Scene progress={progress} />
      </Canvas>
    </SceneBoundary>
  );
}
