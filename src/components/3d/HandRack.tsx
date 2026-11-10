"use client";

import { animated, useSpring } from "@react-spring/three";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useMemo } from "react";
import * as THREE from "three";
import { TILE_LENGTH, TileBody } from "./DominoTile";
import { RACK_LENGTH, RACK_Y, RACK_Z } from "./Table";

export type HandTileSpec = {
  id: string;
  a: number;
  b: number;
  /** Can be played right now. */
  playable: boolean;
  selected: boolean;
  /** Shown darker: it is the player's turn and this tile does not fit. */
  dim: boolean;
};

/** How far the tiles lean back from lying flat; the faces look up at the player. */
const LEAN = THREE.MathUtils.degToRad(62);
const hitGeometry = new THREE.BoxGeometry(1.06, 0.8, TILE_LENGTH + 0.3);

const HandTile = memo(function HandTile({
  tile,
  x,
  scale,
  onTap,
}: {
  tile: HandTileSpec;
  x: number;
  scale: number;
  onTap: (id: string) => void;
}) {
  const lift = tile.selected ? 0.55 : tile.playable ? 0.16 : 0;
  const spring = useSpring({ y: lift, config: { tension: 320, friction: 22 } });
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: tile.dim ? "#8f8b82" : "#f6f1e4",
        roughness: 0.32,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        emissive: tile.selected ? "#f0c86b" : tile.playable ? "#caa24a" : "#000000",
        emissiveIntensity: tile.selected ? 0.35 : tile.playable ? 0.1 : 0,
      }),
    [tile.dim, tile.selected, tile.playable],
  );

  return (
    <animated.group position-x={x} position-y={spring.y} scale={scale}>
      {/* Stand the tile on its lower short edge, leaning back on the ledge. */}
      <group rotation={[LEAN, 0, 0]} position={[0, (TILE_LENGTH / 2) * Math.sin(LEAN) + 0.06, 0]}>
        <TileBody a={tile.a} b={tile.b} material={material} />
        <mesh
          geometry={hitGeometry}
          visible={false}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onTap(tile.id);
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        />
      </group>
    </animated.group>
  );
});

/**
 * The player's own hand, standing face-up in the rack on their side of the
 * table. Tiles grow to fill the rack and squeeze together when the hand is big.
 */
export function HandRack({ tiles, onTap }: { tiles: HandTileSpec[]; onTap: (id: string) => void }) {
  const n = Math.max(tiles.length, 1);
  const usable = RACK_LENGTH + 1.2;
  const scale = Math.min(1.5, Math.max(0.85, usable / (n * 1.08)));
  const spacing = Math.min(1.08 * scale, (usable - scale) / Math.max(n - 1, 1));

  return (
    <group position={[0, RACK_Y, RACK_Z + 0.15]}>
      {tiles.map((t, i) => (
        // A hair of depth per tile so squeezed tiles overlap cleanly instead of fighting.
        <group key={t.id} position-z={i * 0.012}>
          <HandTile tile={t} x={(i - (tiles.length - 1) / 2) * spacing} scale={scale} onTap={onTap} />
        </group>
      ))}
    </group>
  );
}
