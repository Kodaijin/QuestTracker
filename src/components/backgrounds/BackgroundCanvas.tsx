'use client';

import { Canvas } from '@react-three/fiber';
import type { BackgroundKind } from '@/lib/cosmetics';
import { ShaderPlane } from './ShaderPlane';
import {
  AURORA_FRAG,
  NEBULA_FRAG,
  STARFIELD_FRAG,
  FIREFLIES_FRAG,
  OCEAN_FRAG,
  EMBER_FRAG,
  GALAXY_FRAG,
  SAKURA_FRAG,
  SYNTHWAVE_FRAG,
  CONSTELLATION_FRAG,
  RAIN_FRAG,
} from './shaders';

const FRAGMENT: Partial<Record<BackgroundKind, string>> = {
  'aurora-webgl': AURORA_FRAG,
  nebula: NEBULA_FRAG,
  starfield: STARFIELD_FRAG,
  fireflies: FIREFLIES_FRAG,
  ocean: OCEAN_FRAG,
  ember: EMBER_FRAG,
  galaxy: GALAXY_FRAG,
  sakura: SAKURA_FRAG,
  synthwave: SYNTHWAVE_FRAG,
  constellations: CONSTELLATION_FRAG,
  rain: RAIN_FRAG,
};

/**
 * Full-screen WebGL backdrop for a given background kind. Mounted only on the
 * client (via dynamic import) and only when WebGL is enabled — see
 * BackgroundLayer. Sits behind all content at `-z-10`, non-interactive.
 */
export default function BackgroundCanvas({
  kind,
  colorA,
  colorB,
}: {
  kind: BackgroundKind;
  colorA: string;
  colorB: string;
}) {
  const fragment = FRAGMENT[kind];
  if (!fragment) return null;

  return (
    <Canvas
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -10,
        pointerEvents: 'none',
      }}
      gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
      dpr={[1, 2]}
    >
      {/* Key by kind so the material is fully recreated on a background switch —
          three.js won't recompile a shader program from a prop change alone. */}
      <ShaderPlane key={kind} fragment={fragment} colorA={colorA} colorB={colorB} />
    </Canvas>
  );
}
