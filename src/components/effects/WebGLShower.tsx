'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { CelebrationKind } from '@/lib/cosmetics';

const DURATION = 1900; // ms — animate, then unmount to dispose the canvas.

/** Per-kind base particle count (scaled by `scale`). */
const COUNTS: Record<CelebrationKind, number> = {
  stars: 280,
  confetti: 240,
  fireworks: 280,
  coins: 130,
  embers: 220,
  petals: 160,
  runes: 90,
  frost: 200,
  vortex: 220,
};

/** Per-kind point size (world units) and blend mode. Confetti/petals read as
 *  solid bits (normal blending); the rest glow additively under bloom. */
const SIZE: Record<CelebrationKind, number> = {
  stars: 0.12,
  confetti: 0.18,
  fireworks: 0.13,
  coins: 0.16,
  embers: 0.12,
  petals: 0.17,
  runes: 0.22,
  frost: 0.11,
  vortex: 0.13,
};

function blendFor(kind: CelebrationKind): THREE.Blending {
  return kind === 'confetti' || kind === 'petals'
    ? THREE.NormalBlending
    : THREE.AdditiveBlending;
}

/**
 * A transient full-screen GPU celebration with bloom. The `kind` selects the
 * particle behavior (motion, blending, palette); `scale` sizes the burst (bigger
 * for level-ups). Auto-disposes after the animation by unmounting the canvas.
 *
 * Mounted via dynamic import and only when WebGL is available — see QuestEffects.
 */
export default function WebGLShower({
  kind = 'stars',
  colors,
  scale = 1,
}: {
  kind?: CelebrationKind;
  colors: string[];
  scale?: number;
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
        <Burst kind={kind} colors={colors} scale={scale} />
        <EffectComposer>
          <Bloom intensity={1.3} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

/** A soft round particle sprite (radial gradient), tinted per-particle. */
function makeSprite(): THREE.Texture {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const TAU = Math.PI * 2;

function Burst({
  kind,
  colors,
  scale,
}: {
  kind: CelebrationKind;
  colors: string[];
  scale: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const { viewport } = useThree();
  const startRef = useRef<number | null>(null);
  const sprite = useMemo(makeSprite, []);

  const count = Math.round(COUNTS[kind] * scale);

  // Per-particle initial state, generated once. Positions are integrated each
  // frame from p0 + vel*t + gravity; `param` carries [gravity, swayAmp, swayFreq, phase].
  const data = useMemo(() => {
    const vw = viewport.width;
    const vh = viewport.height;
    const palette = colors.map((c) => new THREE.Color(c));

    const positions = new Float32Array(count * 3);
    const p0 = new Float32Array(count * 2);
    const vel = new Float32Array(count * 2);
    const param = new Float32Array(count * 4);
    const colorArr = new Float32Array(count * 3);

    // Fireworks burst origins (a handful of explosion centers).
    const nCenters = Math.max(3, Math.round(5 * scale));
    const centers: { x: number; y: number }[] = Array.from({ length: nCenters }, () => ({
      x: (Math.random() - 0.5) * vw * 0.7,
      y: (Math.random() - 0.2) * vh * 0.5,
    }));

    for (let i = 0; i < count; i++) {
      const r = Math.random;
      let x0 = 0;
      let y0 = 0;
      let vx = 0;
      let vy = 0;
      let g = 0;
      let swayAmp = 0;
      let swayFreq = 0;
      const phase = r() * TAU;

      switch (kind) {
        case 'confetti':
          x0 = (r() - 0.5) * vw;
          y0 = vh / 2 + r() * 0.6;
          vx = (r() - 0.5) * 0.8;
          vy = -vh * (0.15 + 0.1 * r());
          g = -vh * 0.15;
          swayAmp = 0.18;
          swayFreq = 7 + r() * 3;
          break;
        case 'fireworks': {
          const c = centers[i % nCenters];
          x0 = c.x;
          y0 = c.y;
          const ang = r() * TAU;
          const spd = vh * (0.25 + 0.5 * r());
          vx = Math.cos(ang) * spd;
          vy = Math.sin(ang) * spd;
          g = -vh * 0.25;
          break;
        }
        case 'coins':
          x0 = (r() - 0.5) * vw * 0.25;
          y0 = -vh * 0.45;
          vx = (r() - 0.5) * vw * 0.5;
          vy = vh * (0.9 + 0.5 * r());
          g = -vh * 1.6;
          break;
        case 'embers':
          x0 = (r() - 0.5) * vw;
          y0 = -vh / 2 - r() * 0.3;
          vx = (r() - 0.5) * 0.3;
          vy = vh * (0.4 + 0.3 * r());
          swayAmp = 0.12;
          swayFreq = 4 + r() * 2;
          break;
        case 'petals':
          x0 = (r() - 0.5) * vw;
          y0 = vh / 2 + r() * 0.5;
          vx = (r() - 0.5) * 0.2;
          vy = -vh * (0.18 + 0.08 * r());
          swayAmp = 0.25;
          swayFreq = 2 + r() * 1.5;
          break;
        case 'runes':
          x0 = (r() - 0.5) * vw;
          y0 = (r() - 0.5) * vh * 0.6;
          vy = vh * 0.12;
          swayAmp = 0.04;
          swayFreq = 2;
          break;
        case 'frost':
          x0 = (r() - 0.5) * vw;
          y0 = vh / 2 + r() * 0.5;
          vx = (r() - 0.5) * 0.3;
          vy = -vh * (0.18 + 0.1 * r());
          swayAmp = 0.2;
          swayFreq = 3;
          break;
        case 'vortex':
          // Polar: phase holds the launch angle; integrated specially below.
          break;
        case 'stars':
        default:
          x0 = (r() - 0.5) * vw;
          y0 = -vh / 2 - r() * 0.4;
          vx = (r() - 0.5) * 0.4;
          vy = vh * (0.45 + 0.3 * r());
          swayAmp = 0.05;
          swayFreq = 6;
          break;
      }

      p0[i * 2] = x0;
      p0[i * 2 + 1] = y0;
      vel[i * 2] = vx;
      vel[i * 2 + 1] = vy;
      param[i * 4] = g;
      param[i * 4 + 1] = swayAmp;
      param[i * 4 + 2] = swayFreq;
      // For the vortex, store the launch angle in the phase slot.
      param[i * 4 + 3] = kind === 'vortex' ? (i / count) * TAU + (r() - 0.5) * 0.4 : phase;

      positions[i * 3] = x0;
      positions[i * 3 + 1] = y0;

      const col = palette[i % palette.length];
      colorArr[i * 3] = col.r;
      colorArr[i * 3 + 1] = col.g;
      colorArr[i * 3 + 2] = col.b;
    }

    const vortexRadius = Math.max(vw, vh) * 0.45;
    return { positions, p0, vel, param, colorArr, vortexRadius };
    // viewport/colors are captured once for this short-lived burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, count]);

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startRef.current;
    const t = Math.min(1, elapsed / (DURATION / 1000));

    const geo = pointsRef.current?.geometry;
    if (geo) {
      const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < count; i++) {
        if (kind === 'vortex') {
          const a0 = data.param[i * 4 + 3];
          const ang = a0 + elapsed * 5.0;
          const rad = t * data.vortexRadius;
          arr[i * 3] = Math.cos(ang) * rad;
          arr[i * 3 + 1] = Math.sin(ang) * rad;
        } else {
          const g = data.param[i * 4];
          const swayAmp = data.param[i * 4 + 1];
          const swayFreq = data.param[i * 4 + 2];
          const phase = data.param[i * 4 + 3];
          arr[i * 3] =
            data.p0[i * 2] + data.vel[i * 2] * elapsed + swayAmp * Math.sin(elapsed * swayFreq + phase);
          arr[i * 3 + 1] =
            data.p0[i * 2 + 1] + data.vel[i * 2 + 1] * elapsed + 0.5 * g * elapsed * elapsed;
        }
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Fade in quickly, hold, then fade out.
    if (matRef.current) {
      matRef.current.opacity = t < 0.12 ? t / 0.12 : 1 - Math.max(0, (t - 0.6) / 0.4);
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
        map={sprite}
        size={SIZE[kind] * (0.85 + 0.3 * scale)}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={blendFor(kind)}
      />
    </points>
  );
}
