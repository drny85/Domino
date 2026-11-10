"use client";

import { RoundedBox } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useMemo, useState } from "react";
import * as THREE from "three";
import { PIP_LAYOUT } from "@/lib/pips";

export const TILE_WIDTH = 1;
export const TILE_HEIGHT = 0.25;
export const TILE_LENGTH = 2;

const PIP_SPACING = 0.27;
const TOP = TILE_HEIGHT / 2;

// Shared geometry and materials: every tile on the table reuses these.
const pipGeometry = new THREE.CylinderGeometry(0.085, 0.075, 0.03, 20);
const pipMaterial = new THREE.MeshStandardMaterial({ color: "#16161a", roughness: 0.55, metalness: 0.1 });
const dividerGeometry = new THREE.BoxGeometry(0.78, 0.012, 0.035);
const dividerMaterial = new THREE.MeshStandardMaterial({ color: "#3b3a38", roughness: 0.6 });
const spinnerGeometry = new THREE.CylinderGeometry(0.065, 0.065, 0.022, 24);
const spinnerMaterial = new THREE.MeshStandardMaterial({ color: "#d4a548", roughness: 0.25, metalness: 0.9 });

function Pips({ value, half }: { value: number; half: -1 | 1 }) {
  return (
    <>
      {PIP_LAYOUT[value].map(([c, r], i) => (
        <mesh
          key={i}
          geometry={pipGeometry}
          material={pipMaterial}
          // Slightly sunk into the face so it reads as an inlaid pip.
          position={[c * PIP_SPACING, TOP - 0.008, half * 0.5 + r * PIP_SPACING]}
        />
      ))}
    </>
  );
}

/** Body, divider, spinner and pips of one tile, centred on its own origin. */
export function TileBody({ a, b, material }: { a: number; b: number; material: THREE.Material }) {
  return (
    <>
      <RoundedBox args={[TILE_WIDTH, TILE_HEIGHT, TILE_LENGTH]} radius={0.06} smoothness={4} material={material} castShadow receiveShadow />
      <mesh geometry={dividerGeometry} material={dividerMaterial} position={[0, TOP + 0.001, 0]} />
      <mesh geometry={spinnerGeometry} material={spinnerMaterial} position={[0, TOP + 0.004, 0]} />
      <Pips value={a} half={-1} />
      <Pips value={b} half={1} />
    </>
  );
}

export type DominoTileProps = {
  a: number;
  b: number;
  position: [number, number, number];
  rotationY?: number;
  /** Translucent preview for a legal drop spot. */
  ghost?: boolean;
  /** Glows (used for the most recently played tile). */
  highlight?: boolean;
  /** Animate in by dropping from above. */
  dropIn?: boolean;
  onSelect?: () => void;
};

/**
 * Procedural Double-Six domino. 1 (x) × 0.25 (y) × 2 (z). Value `a` is on
 * the -z half and `b` on the +z half; pips are on the top (+y) face.
 */
export const DominoTile = memo(function DominoTile({
  a,
  b,
  position,
  rotationY = 0,
  ghost = false,
  highlight = false,
  dropIn = true,
  onSelect,
}: DominoTileProps) {
  const [hovered, setHovered] = useState(false);
  const [x, y, z] = position;
  const lift = ghost && hovered ? 0.15 : 0;

  const spring = useSpring({
    from: dropIn ? { position: [x, y + 4, z], rotation: [0.6, rotationY + 0.8, 0.3] } : undefined,
    to: { position: [x, y + lift, z], rotation: [0, rotationY, 0] },
    config: { mass: 1, tension: 210, friction: 22 },
  });

  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: ghost ? "#fff6c9" : "#f6f1e4",
        roughness: 0.32,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        sheen: 0.2,
        transparent: ghost,
        opacity: ghost ? 0.7 : 1,
        emissive: ghost || highlight ? "#f0c86b" : "#000000",
        emissiveIntensity: ghost ? (hovered ? 0.8 : 0.5) : highlight ? 0.18 : 0,
      }),
    [ghost, highlight, hovered],
  );

  const handlers = onSelect
    ? {
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect();
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHovered(false);
          document.body.style.cursor = "";
        },
      }
    : {};

  return (
    <animated.group
      position={spring.position as unknown as [number, number, number]}
      rotation={spring.rotation as unknown as [number, number, number]}
    >
      <group position={[0, TILE_HEIGHT / 2, 0]} {...handlers}>
        <TileBody a={a} b={b} material={bodyMaterial} />
        {/* Generous invisible hit area for fingers on small screens. */}
        {ghost && (
          <mesh visible={false}>
            <boxGeometry args={[TILE_WIDTH + 0.8, 0.6, TILE_LENGTH + 0.8]} />
          </mesh>
        )}
      </group>
    </animated.group>
  );
});
