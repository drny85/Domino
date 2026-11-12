"use client";

import { animated, useSpring } from "@react-spring/three";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { TILE_HEIGHT, TILE_LENGTH, TILE_WIDTH, TileBody } from "./DominoTile";
import { IVORY, ivoryTint } from "./materials";
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
/** Gold rim drawn just outside a playable tile, like the iOS hand. Only its back faces show, so it reads as an outline. */
const RIM = 0.13;
const rimPlayable = new THREE.MeshBasicMaterial({ color: "#f2c14e", side: THREE.BackSide, toneMapped: false });
const rimSelected = new THREE.MeshBasicMaterial({ color: "#ffe08a", side: THREE.BackSide, toneMapped: false });

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
  const lift = tile.selected ? 0.6 : tile.playable ? 0.32 : 0;
  const spring = useSpring({ y: lift, config: { tension: 320, friction: 22 } });
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        ...IVORY,
        color: tile.dim ? "#8d877c" : ivoryTint(tile.a, tile.b),
        emissive: tile.selected ? "#f0c86b" : tile.playable ? "#e0b350" : "#000000",
        emissiveIntensity: tile.selected ? 0.4 : tile.playable ? 0.22 : 0,
      }),
    [tile.a, tile.b, tile.dim, tile.selected, tile.playable],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <animated.group position-x={x} position-y={spring.y} scale={scale}>
      {/* Stand the tile on its lower short edge, leaning back on the ledge. */}
      <group rotation={[LEAN, 0, 0]} position={[0, (TILE_LENGTH / 2) * Math.sin(LEAN) + 0.06, 0]}>
        <TileBody a={tile.a} b={tile.b} material={material} />
        {(tile.playable || tile.selected) && (
          <RoundedBox
            args={[TILE_WIDTH + RIM * 2, TILE_HEIGHT + RIM, TILE_LENGTH + RIM * 2]}
            radius={0.09}
            smoothness={3}
            material={tile.selected ? rimSelected : rimPlayable}
          />
        )}
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
 * Size and spacing of the hand in its rack. Tiles grow to fill the rack and
 * squeeze together when the hand is big. On portrait screens they stay
 * closer to board size so the camera can sit nearer the table.
 */
export function handLayout(count: number, portrait: boolean) {
  const n = Math.max(count, 1);
  const usable = RACK_LENGTH + 1.2;
  const scale = Math.min(portrait ? 1.05 : 1.5, Math.max(0.85, usable / (n * 1.08)));
  const spacing = Math.min(1.08 * scale, (usable - scale) / Math.max(n - 1, 1));
  return { scale, spacing, halfWidth: ((n - 1) * spacing + scale) / 2 };
}

/** The player's own hand, standing face-up in the rack on their side of the table. */
export function HandRack({ tiles, onTap }: { tiles: HandTileSpec[]; onTap: (id: string) => void }) {
  const portrait = useThree((s) => s.size.width < s.size.height);
  const { scale, spacing } = handLayout(tiles.length, portrait);

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
