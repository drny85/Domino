"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { FLOOR_Y } from "./Table";

/** Stripes running around an object: one band per colour, repeated. */
function stripes(colors: string[], repeat: number) {
  const canvas = document.createElement("canvas");
  canvas.width = colors.length * repeat * 16;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < colors.length * repeat; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(i * 16, 0, 16, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A beach umbrella planted in the sand and a ball beside the table. */
function BeachProps() {
  const canopy = useMemo(() => stripes(["#ffffff", "#f4a261"], 6), []);
  const ball = useMemo(() => stripes(["#f25c54", "#ffffff", "#ffd166", "#ffffff", "#3fa7d6", "#ffffff"], 1), []);
  return (
    <>
      <group position={[-29, FLOOR_Y, -9]} rotation={[0, 0, 0.1]}>
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 7, 10]} />
          <meshStandardMaterial color="#e9e4d8" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 7.3, 0]} castShadow>
          <coneGeometry args={[5.5, 2, 12, 1, true]} />
          <meshStandardMaterial map={canopy} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 8.4, 0]}>
          <sphereGeometry args={[0.3, 12, 8]} />
          <meshStandardMaterial color="#f4a261" roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[27, FLOOR_Y + 2, 6]} rotation={[0.5, 0.3, 0.2]} castShadow>
        <sphereGeometry args={[2, 32, 20]} />
        <meshPhysicalMaterial map={ball} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.3} />
      </mesh>
    </>
  );
}

/** Solid objects that stand around the table in a given surrounding. */
export function SceneProps({ sceneId }: { sceneId: string }) {
  if (sceneId === "beach") return <BeachProps />;
  return null;
}
