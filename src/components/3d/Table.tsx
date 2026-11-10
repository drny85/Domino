"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getScene } from "@/lib/scenes";
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
const LEG_LENGTH = 9;
/** Height of the floor under the table. */
export const FLOOR_Y = RAIL_TOP - RAIL_HEIGHT - LEG_LENGTH;
const FLOOR_SIZE = 90;
const BACKDROP_HEIGHT = 60;
/** Usable length of a tile rack. */
export const RACK_LENGTH = SURFACE_SIZE * 0.62;
/** Where a rack sits on its rail, in the rail's local frame (see OpponentRack). */
export const RACK_Z = HALF + RAIL_WIDTH / 2 + 0.1;
export const RACK_Y = RAIL_TOP + 0.03;
/** Centre of a corner cup holder: distance from the table centre on x and z, and the height of its well. */
export const CUP_OFFSET = HALF + RAIL_WIDTH / 2;
export const CUP_Y = RAIL_TOP + 0.16;
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

function Rail({ rotation, wood, darkWood, brass }: { rotation: number; wood: THREE.Material; darkWood: THREE.Material; brass: THREE.Material }) {
  const length = SURFACE_SIZE;
  const y = RAIL_TOP - RAIL_HEIGHT / 2;
  return (
    <group rotation={[0, rotation, 0]}>
      <group position={[0, 0, HALF + RAIL_WIDTH / 2]}>
        <RoundedBox args={[length + 0.2, RAIL_HEIGHT, RAIL_WIDTH]} radius={0.1} smoothness={3} position={[0, y, 0]} material={wood} castShadow receiveShadow />
        {/* Tile rack: a routed groove with a raised back ledge and a low front lip. */}
        <mesh position={[0, RAIL_TOP + 0.012, 0.1]} material={darkWood} receiveShadow>
          <boxGeometry args={[RACK_LENGTH + 1.4, 0.02, 1.15]} />
        </mesh>
        <RoundedBox args={[RACK_LENGTH + 2, 0.24, 0.24]} radius={0.06} smoothness={2} position={[0, RAIL_TOP + 0.1, 0.8]} material={wood} castShadow receiveShadow />
        <RoundedBox args={[RACK_LENGTH + 2, 0.12, 0.16]} radius={0.04} smoothness={2} position={[0, RAIL_TOP + 0.05, -0.56]} material={wood} castShadow receiveShadow />
        {/* Stepped moulding and a brass inlay where the rail meets the playing surface.
            Both sit proud of the rail faces: coplanar faces would shimmer. */}
        <mesh position={[0, (RAIL_TOP - 0.12) / 2, -RAIL_WIDTH / 2 - 0.07]} material={darkWood} castShadow receiveShadow>
          <boxGeometry args={[length, RAIL_TOP - 0.12, 0.22]} />
        </mesh>
        <mesh position={[0, RAIL_TOP + 0.008, -RAIL_WIDTH / 2 + 0.32]} material={brass}>
          <boxGeometry args={[length - 0.6, 0.016, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}

function Corner({ x, z, wood, steel, steelDark }: { x: number; z: number; wood: THREE.Material; steel: THREE.Material; steelDark: THREE.Material }) {
  const top = RAIL_TOP + 0.14;
  const height = RAIL_HEIGHT + 0.2;
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[CORNER, height, CORNER]} radius={0.16} smoothness={3} position={[0, top - height / 2, 0]} material={wood} castShadow receiveShadow />
      {/* Cup holder: a raised steel rim around a sunken, darker well. */}
      <mesh position={[0, top + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={steel} castShadow>
        <torusGeometry args={[1.05, 0.09, 12, 48]} />
      </mesh>
      <mesh position={[0, top + 0.012, 0]} material={steelDark} receiveShadow>
        <cylinderGeometry args={[1.02, 1.02, 0.02, 48]} />
      </mesh>
      <mesh position={[0, top + 0.026, 0]} material={steel}>
        <cylinderGeometry args={[0.55, 0.55, 0.012, 40]} />
      </mesh>
      {/* Leg */}
      <mesh position={[0, top - height - LEG_LENGTH / 2 + 0.05, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.95, 0.6, LEG_LENGTH, 4, 1, false, Math.PI / 4]} />
      </mesh>
    </group>
  );
}

export function Table() {
  const themeId = useThemeStore((s) => s.themeId);
  const theme = getTheme(themeId);
  const scene = getScene(useThemeStore((s) => s.sceneId));

  // The surroundings: a painted ground and a painted backdrop behind the far side.
  const surroundings = useMemo(() => {
    const paint = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      draw(canvas.getContext("2d")!);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      return tex;
    };
    return {
      floor: paint(2048, 2048, (ctx) => scene.floor(ctx, 2048)),
      backdrop: paint(2048, 512, (ctx) => scene.backdrop(ctx, 2048, 512)),
    };
  }, [scene]);
  useEffect(
    () => () => {
      surroundings.floor.dispose();
      surroundings.backdrop.dispose();
    },
    [surroundings],
  );

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
      steelDark: new THREE.MeshStandardMaterial({ color: "#6f757b", roughness: 0.4, metalness: 1 }),
      brass: new THREE.MeshStandardMaterial({ color: "#d4a548", roughness: 0.28, metalness: 0.9 }),
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats],
  );

  const c = HALF + RAIL_WIDTH / 2;
  return (
    <group>
      {/* Playing surface with the theme artwork */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SURFACE_SIZE, SURFACE_SIZE]} />
        <meshStandardMaterial map={art} roughness={0.9} metalness={0} />
      </mesh>

      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <Rail key={r} rotation={r} wood={mats.wood} darkWood={mats.darkWood} brass={mats.brass} />
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
      <mesh position={[0, -0.75, 0]} material={mats.darkWood} castShadow>
        <boxGeometry args={[SURFACE_SIZE + RAIL_WIDTH, 1.1, SURFACE_SIZE + RAIL_WIDTH]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial map={surroundings.floor} roughness={0.9} />
      </mesh>
      <mesh position={[0, FLOOR_Y + BACKDROP_HEIGHT / 2, -FLOOR_SIZE / 2]}>
        <planeGeometry args={[FLOOR_SIZE * 2.2, BACKDROP_HEIGHT]} />
        <meshBasicMaterial map={surroundings.backdrop} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
