"use client";

import { animated, useSpring } from "@react-spring/three";
import { useMemo } from "react";
import * as THREE from "three";
import { RACK_LENGTH, RACK_Y, RACK_Z } from "./Table";

export type RackSide = "north" | "east" | "west" | "south";
export type RackSpec = { side: RackSide; count: number; active: boolean };

const ROTATION: Record<RackSide, number> = { north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2, south: 0 };

const tileGeometry = new THREE.BoxGeometry(0.96, 2, 0.25);
const tileMaterial = new THREE.MeshPhysicalMaterial({ color: "#f3eee0", roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });

/**
 * An opponent's hand: one face-down tile per tile they hold, standing on the
 * rack on their side of the table. Only the count is known to this client,
 * so every tile is a blank back.
 */
export function OpponentRack({ side, count, active }: RackSpec) {
  const spacing = Math.min(1.06, (RACK_LENGTH - 0.6) / Math.max(count, 1));
  const tiles = useMemo(() => Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * spacing), [count, spacing]);
  const glow = useSpring({ intensity: active ? 1 : 0 });

  return (
    <group rotation={[0, ROTATION[side], 0]}>
      <group position={[0, RACK_Y, RACK_Z]}>
        {tiles.map((x, i) => (
          // Leaning back slightly against the rack's ledge, backs toward the table.
          <mesh key={i} geometry={tileGeometry} material={tileMaterial} position={[x, 0.98, 0.18]} rotation={[0.2, 0, 0]} />
        ))}
        {/* Turn light: a brass strip in front of the rack glows for the player to move. */}
        <mesh position={[0, 0.03, -0.95]}>
          <boxGeometry args={[RACK_LENGTH, 0.05, 0.12]} />
          <animated.meshStandardMaterial
            color="#d4a548"
            emissive="#ffc94d"
            emissiveIntensity={glow.intensity.to((v) => v * 2.2)}
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>
      </group>
    </group>
  );
}
