'use client';

import dynamic from 'next/dynamic';
import AmbientBackground from '@/components/AmbientBackground';
import { useWebGLEnabled } from '@/lib/useWebGL';
import { backgroundFor, getCosmetic } from '@/lib/cosmetics';

// three.js stays out of the initial bundle — loaded only when a WebGL background
// is actually shown.
const BackgroundCanvas = dynamic(() => import('@/components/backgrounds/BackgroundCanvas'), {
  ssr: false,
});

/**
 * Chooses the ambient backdrop for the signed-in user. The CSS aurora
 * (`AmbientBackground`) is the SSR default and the universal fallback; a WebGL
 * background canvas takes over only when one is equipped *and* WebGL is enabled
 * (not reduced-motion, context available — see `useWebGLEnabled`).
 */
export default function BackgroundLayer({ backgroundId }: { backgroundId: string | null }) {
  const webglEnabled = useWebGLEnabled();
  const kind = backgroundFor(backgroundId);
  const useCanvas = webglEnabled && kind !== 'css';

  const swatch = (backgroundId && getCosmetic(backgroundId)?.swatch) || ['#818cf8', '#22d3ee'];

  return (
    <>
      {!useCanvas && <AmbientBackground />}
      {useCanvas && <BackgroundCanvas kind={kind} colorA={swatch[0]} colorB={swatch[1]} />}
    </>
  );
}
