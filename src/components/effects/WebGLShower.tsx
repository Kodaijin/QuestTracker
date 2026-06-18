'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

const DURATION = 1800; // ms — matches the CSS sparkle-rise feel, then unmounts.

/**
 * A transient full-screen GPU particle shower with bloom, used for the big
 * celebrations (level up / quest complete / pet evolve). Auto-disposes after the
 * animation by unmounting the canvas. Non-interactive; sits above content.
 *
 * Mounted via dynamic import and only when WebGL is available — see QuestEffects.
 */
export default function WebGLShower({
  colors,
  count = 220,
}: {
  /** Hex colors the particles are tinted from. */
  colors: string[];
  count?: number;
}) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDone(true), DURATION);
    return () => clearTimeout(id);
  }, []);

  if (done) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden>
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 50 }}
      >
        <Shower colors={colors} count={count} />
        <EffectComposer>
          <Bloom intensity={1.3} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function Shower({ colors, count }: { colors: string[]; count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const { viewport } = useThree();
  const startRef = useRef<number | null>(null);

  // Per-particle initial position, velocity, drift and size — generated once.
  const data = useMemo(() => {
    const palette = colors.map((c) => new THREE.Color(c));
    const positions = new Float32Array(count * 3);
    const start = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const colorArr = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * viewport.width;
      const y = -viewport.height / 2 - Math.random() * 0.5;
      start[i * 3] = x;
      start[i * 3 + 1] = y;
      start[i * 3 + 2] = 0;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 0;

      vel[i * 3] = (Math.random() - 0.5) * 0.6; // horizontal drift
      vel[i * 3 + 1] = viewport.height * (0.8 + Math.random() * 0.6); // rise speed
      vel[i * 3 + 2] = 0;

      const c = palette[i % palette.length];
      colorArr[i * 3] = c.r;
      colorArr[i * 3 + 1] = c.g;
      colorArr[i * 3 + 2] = c.b;
    }
    return { positions, start, vel, colorArr };
    // viewport is read once at mount; the shower is short-lived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - startRef.current) / (DURATION / 1000));
    const eased = 1 - Math.pow(1 - t, 2); // ease-out

    const geo = pointsRef.current?.geometry;
    if (geo) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = data.start[i * 3] + data.vel[i * 3] * eased + Math.sin(t * 6 + i) * 0.05;
        arr[i * 3 + 1] = data.start[i * 3 + 1] + data.vel[i * 3 + 1] * eased;
      }
      pos.needsUpdate = true;
    }

    // Fade in quickly, hold, then fade out.
    if (matRef.current) {
      matRef.current.opacity = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colorArr, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.14}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
