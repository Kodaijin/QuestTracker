'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VERTEX } from './shaders';

/**
 * A fullscreen quad driven by one of the background fragment shaders. The two
 * accent colors come from the equipped background cosmetic's swatch, so each
 * background keeps its own palette. Animates via a `uTime` uniform.
 */
export function ShaderPlane({
  fragment,
  colorA,
  colorB,
}: {
  fragment: string;
  colorA: string;
  colorB: string;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
    }),
    // Colors are kept in sync via the effect below; only build the object once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    uniforms.uResolution.value.set(size.width, size.height);
  }, [size, uniforms]);

  useEffect(() => {
    uniforms.uColorA.value.set(colorA);
    uniforms.uColorB.value.set(colorB);
  }, [colorA, colorB, uniforms]);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={fragment}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
