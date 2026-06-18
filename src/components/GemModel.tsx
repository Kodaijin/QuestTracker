'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A small, slowly spinning faceted gem. Stands in for the 💎 glyph where the
 * Quest Gems balance is shown. Mounted via dynamic import; callers fall back to
 * the glyph when WebGL is unavailable.
 */
export default function GemModel({
  size = 28,
  color = '#67e8f9',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none inline-block align-middle"
      style={{ width: size, height: size }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <directionalLight position={[-3, -1, -2]} intensity={0.6} color="#a5f3fc" />
        <Gem color={color} />
      </Canvas>
    </span>
  );
}

function Gem({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 1.2;
  });
  return (
    <mesh ref={ref} rotation={[0.45, 0, 0.12]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={color}
        metalness={0.35}
        roughness={0.12}
        emissive={color}
        emissiveIntensity={0.25}
        flatShading
      />
    </mesh>
  );
}
