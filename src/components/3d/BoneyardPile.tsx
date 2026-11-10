"use client";

import { useMemo } from "react";
import { tileBackGeometry, tileBackMaterial } from "./materials";
import { TILE_HEIGHT } from "./DominoTile";
import { SURFACE_SIZE } from "./Table";


const PER_STACK = 4;

/**
 * The boneyard: face-down tiles stacked in the far right corner of the table,
 * shrinking as players draw. Only the count is known to this client.
 */
export function BoneyardPile({ count }: { count: number }) {
  const tiles = useMemo(() => {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
    const edge = SURFACE_SIZE / 2 - 1.5;
    return Array.from({ length: 28 }, (_, i) => {
      const stack = Math.floor(i / PER_STACK);
      const level = i % PER_STACK;
      return {
        position: [edge - (stack % 4) * 1.25 + rnd() * 0.06, TILE_HEIGHT / 2 + level * (TILE_HEIGHT + 0.004), -edge + Math.floor(stack / 4) * 2.3 + rnd() * 0.06] as [number, number, number],
        rotation: rnd() * 0.12,
      };
    });
  }, []);

  return (
    <group>
      {tiles.slice(0, Math.min(count, tiles.length)).map((t, i) => (
        <mesh key={i} geometry={tileBackGeometry(0.96, TILE_HEIGHT, 1.96)} material={tileBackMaterial()} position={t.position} rotation={[0, t.rotation, 0]} castShadow receiveShadow />
      ))}
    </group>
  );
}
