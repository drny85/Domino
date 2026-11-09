"use client";

import { useMemo } from "react";
import * as THREE from "three";

export const TABLE_RADIUS = 24;

/** Procedural felt: radial vignette plus fine noise, drawn to a canvas. */
function makeFeltTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, "#1d6a4a");
  g.addColorStop(0.7, "#155038");
  g.addColorStop(1, "#0d3526");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function Table() {
  const felt = useMemo(makeFeltTexture, []);
  return (
    <group>
      {/* Felt top */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[TABLE_RADIUS, 96]} />
        <meshStandardMaterial map={felt} roughness={0.95} metalness={0} />
      </mesh>
      {/* Wooden rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <torusGeometry args={[TABLE_RADIUS + 0.6, 0.75, 20, 128]} />
        <meshStandardMaterial color="#5a3420" roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Floor far below so the edge never shows a void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#08140f" roughness={1} />
      </mesh>
    </group>
  );
}
