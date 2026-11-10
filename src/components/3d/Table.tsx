"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getTheme, paintTheme } from "@/lib/themes";
import { useThemeStore } from "@/store/useThemeStore";

/**
 * A square wooden domino table, built from primitives:
 * a recessed playing surface carrying the theme artwork, four rails with a
 * tile rack each, and four corner blocks with a metal cup holder.
 */

/** Side length of the square playing surface (a tile is 1 × 2). */
export const SURFACE_SIZE = 18;
const HALF = SURFACE_SIZE / 2;
const RAIL_WIDTH = 3.2;
const RAIL_HEIGHT = 0.9;
/** The rails rise this far above the playing surface. */
const RAIL_TOP = 0.55;
const CORNER = RAIL_WIDTH + 0.5;
/** Usable length of a tile rack. */
export const RACK_LENGTH = SURFACE_SIZE * 0.62;
/** Where a rack sits on its rail, in the rail's local frame (see OpponentRack). */
export const RACK_Z = HALF + RAIL_WIDTH / 2 + 0.1;
export const RACK_Y = RAIL_TOP + 0.03;
/** Outer half-size of the whole table, for camera framing. */
export const TABLE_HALF = HALF + RAIL_WIDTH + 0.25;

/** Stained wood: warm base, long grain streaks and a few knots. */
function makeWoodTexture(seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const w = 1024;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#6b3f22");
  base.addColorStop(0.5, "#7a4a28");
  base.addColorStop(1, "#5e361c");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Grain: wavy streaks running along the board.
  for (let i = 0; i < 90; i++) {
    const y0 = rnd() * h;
    const amp = 2 + rnd() * 6;
    const freq = 0.004 + rnd() * 0.01;
    const phase = rnd() * 10;
    ctx.strokeStyle = rnd() > 0.5 ? `rgba(40,20,8,${0.08 + rnd() * 0.22})` : `rgba(210,150,90,${0.04 + rnd() * 0.1})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      ctx[x === 0 ? "moveTo" : "lineTo"](x, y);
    }
    ctx.stroke();
  }
  // Knots.
  for (let i = 0; i < 3; i++) {
    const x = rnd() * w;
    const y = 30 + rnd() * (h - 60);
    for (let r = 14; r > 2; r -= 3) {
      ctx.strokeStyle = `rgba(35,18,8,${0.12 + (14 - r) * 0.02})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Rail({ rotation, wood, darkWood }: { rotation: number; wood: THREE.Material; darkWood: THREE.Material }) {
  const length = SURFACE_SIZE;
  const y = RAIL_TOP - RAIL_HEIGHT / 2;
  return (
    <group rotation={[0, rotation, 0]}>
      <group position={[0, 0, HALF + RAIL_WIDTH / 2]}>
        <mesh position={[0, y, 0]} material={wood}>
          <boxGeometry args={[length, RAIL_HEIGHT, RAIL_WIDTH]} />
        </mesh>
        {/* Tile rack: a shallow tray with a raised back ledge. */}
        <mesh position={[0, RAIL_TOP + 0.01, 0.1]} material={darkWood}>
          <boxGeometry args={[RACK_LENGTH, 0.04, 1.15]} />
        </mesh>
        <mesh position={[0, RAIL_TOP + 0.09, 0.78]} material={wood}>
          <boxGeometry args={[RACK_LENGTH + 0.6, 0.18, 0.22]} />
        </mesh>
        <mesh position={[0, RAIL_TOP + 0.05, -0.56]} material={wood}>
          <boxGeometry args={[RACK_LENGTH + 0.6, 0.1, 0.14]} />
        </mesh>
        {/* Inner lip where the rail meets the playing surface. */}
        <mesh position={[0, RAIL_TOP / 2, -RAIL_WIDTH / 2 + 0.06]} material={darkWood}>
          <boxGeometry args={[length, RAIL_TOP, 0.12]} />
        </mesh>
      </group>
    </group>
  );
}

function Corner({ x, z, wood, steel, steelDark }: { x: number; z: number; wood: THREE.Material; steel: THREE.Material; steelDark: THREE.Material }) {
  const top = RAIL_TOP + 0.12;
  const height = RAIL_HEIGHT + 0.12;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, top - height / 2, 0]} material={wood}>
        <boxGeometry args={[CORNER, height, CORNER]} />
      </mesh>
      {/* Cup holder: steel rim with a recessed, darker base. */}
      <mesh position={[0, top + 0.012, 0]} material={steel}>
        <cylinderGeometry args={[1.12, 1.12, 0.03, 40]} />
      </mesh>
      <mesh position={[0, top + 0.03, 0]} material={steelDark}>
        <cylinderGeometry args={[0.95, 0.95, 0.012, 40]} />
      </mesh>
    </group>
  );
}

export function Table() {
  const themeId = useThemeStore((s) => s.themeId);
  const theme = getTheme(themeId);

  const art = useMemo(() => {
    const canvas = document.createElement("canvas");
    paintTheme(theme, canvas, 1024);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [theme]);
  useEffect(() => () => art.dispose(), [art]);

  const mats = useMemo(() => {
    const woodTex = makeWoodTexture(11);
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    return {
      woodTex,
      wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5, metalness: 0.05 }),
      darkWood: new THREE.MeshStandardMaterial({ map: woodTex, color: "#7a6a5e", roughness: 0.7 }),
      steel: new THREE.MeshStandardMaterial({ color: "#d9dde0", roughness: 0.22, metalness: 1 }),
      steelDark: new THREE.MeshStandardMaterial({ color: "#9aa0a6", roughness: 0.35, metalness: 1 }),
    };
  }, []);
  useEffect(
    () => () => {
      mats.woodTex.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats],
  );

  const c = HALF + RAIL_WIDTH / 2;
  return (
    <group>
      {/* Playing surface with the theme artwork */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SURFACE_SIZE, SURFACE_SIZE]} />
        <meshStandardMaterial map={art} roughness={0.82} metalness={0} />
      </mesh>

      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <Rail key={r} rotation={r} wood={mats.wood} darkWood={mats.darkWood} />
      ))}
      {[
        [c, c],
        [-c, c],
        [c, -c],
        [-c, -c],
      ].map(([x, z]) => (
        <Corner key={`${x},${z}`} x={x} z={z} wood={mats.wood} steel={mats.steel} steelDark={mats.steelDark} />
      ))}

      {/* Apron under the table and the floor below it */}
      <mesh position={[0, -0.9, 0]} material={mats.darkWood}>
        <boxGeometry args={[SURFACE_SIZE + RAIL_WIDTH, 1.2, SURFACE_SIZE + RAIL_WIDTH]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#120d0a" roughness={1} />
      </mesh>
    </group>
  );
}
