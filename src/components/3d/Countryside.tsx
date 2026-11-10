"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { YARD } from "@/lib/countryside";
import { FLOOR_Y } from "./Table";

/* ------------------------------------------------------------------ */
/* Painted surfaces                                                    */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const cache = new Map<string, THREE.CanvasTexture>();
function painted(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, color = true) {
  let tex = cache.get(key);
  if (!tex) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d")!);
    tex = new THREE.CanvasTexture(canvas);
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    cache.set(key, tex);
  }
  return tex;
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/**
 * Upright boards nailed side by side. `paint` is the colour of the coat on
 * top; leave it out for bare, sun-greyed wood.
 */
function plankTexture(key: string, wood: string, paint?: string) {
  return painted(`planks:${key}`, 512, 512, (ctx) => {
    const rnd = rng(key.length * 97 + 13);
    const boards = 8;
    const bw = 512 / boards;
    for (let i = 0; i < boards; i++) {
      const tone = 0.86 + rnd() * 0.26;
      ctx.fillStyle = shade(paint ?? wood, tone);
      ctx.fillRect(i * bw, 0, bw, 512);
      // Grain along the board.
      for (let j = 0; j < 26; j++) {
        ctx.strokeStyle = `rgba(${paint ? "255,255,255" : "60,36,16"},${0.04 + rnd() * 0.09})`;
        ctx.lineWidth = 1 + rnd() * 1.5;
        const x = i * bw + rnd() * bw;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (rnd() - 0.5) * 8, 170, x + (rnd() - 0.5) * 8, 340, x + (rnd() - 0.5) * 6, 512);
        ctx.stroke();
      }
      if (paint) {
        // Paint worn through to the wood, mostly low on the wall.
        for (let j = 0; j < 7; j++) {
          ctx.fillStyle = shade(wood, 0.8 + rnd() * 0.3);
          const y = 512 - rnd() * rnd() * 512;
          ctx.fillRect(i * bw + rnd() * bw * 0.8, y, 2 + rnd() * 7, 6 + rnd() * 30);
        }
      } else if (rnd() > 0.45) {
        const kx = i * bw + bw * (0.3 + rnd() * 0.4);
        const ky = rnd() * 512;
        ctx.fillStyle = "rgba(50,28,12,0.55)";
        ctx.beginPath();
        ctx.ellipse(kx, ky, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // The gap between boards, with a lit edge beside it.
      ctx.fillStyle = "rgba(20,12,6,0.75)";
      ctx.fillRect(i * bw, 0, 3, 512);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(i * bw + 3, 0, 2, 512);
      // Nail heads top and bottom.
      ctx.fillStyle = "rgba(30,24,20,0.7)";
      for (const y of [26, 486]) {
        ctx.beginPath();
        ctx.arc(i * bw + bw / 2, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Corrugated roofing sheets: ridges run down the slope. */
function zincTexture(key: string, color: string, rust: number) {
  return painted(`zinc:${key}`, 512, 512, (ctx) => {
    const rnd = rng(71);
    const ridges = 16;
    const w = 512 / ridges;
    for (let i = 0; i < ridges; i++) {
      const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      g.addColorStop(0, shade(color, 0.62));
      g.addColorStop(0.45, shade(color, 1.18));
      g.addColorStop(0.6, shade(color, 1.05));
      g.addColorStop(1, shade(color, 0.62));
      ctx.fillStyle = g;
      ctx.fillRect(i * w, 0, w + 1, 512);
    }
    // Sheet overlaps and weather streaks.
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 252, 512, 4);
    for (let i = 0; i < 90 * rust; i++) {
      ctx.fillStyle = `rgba(${130 + rnd() * 50},${60 + rnd() * 30},20,${0.08 + rnd() * 0.2})`;
      const y = rnd() > 0.5 ? 256 + rnd() * 40 : rnd() * 512;
      ctx.fillRect(rnd() * 512, y, 3 + rnd() * 10, 20 + rnd() * 120);
    }
  });
}

function leafTexture(a: string, b: string) {
  return painted(`leaf:${a}${b}`, 256, 256, (ctx) => {
    const rnd = rng(5);
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rnd() > 0.5 ? b : shade(a, 0.7 + rnd() * 0.6);
      ctx.beginPath();
      ctx.ellipse(rnd() * 256, rnd() * 256, 3 + rnd() * 7, 2 + rnd() * 4, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** A soft dark spot under anything that stands on the ground. */
function BlobShadow({ size, opacity = 0.34 }: { size: [number, number]; opacity?: number }) {
  const tex = painted(
    "blob",
    64,
    64,
    (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, "#fff");
      g.addColorStop(1, "#000");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    },
    false,
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} scale={[size[0], size[1], 1]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial color="#1a1206" alphaMap={tex} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Movement                                                            */
/* ------------------------------------------------------------------ */

type Stop = [x: number, z: number];

/**
 * The table is drawn only when something changes. Animals need a steady
 * trickle of frames, but far fewer than the screen could show.
 */
function AmbientFrames({ fps = 24 }: { fps?: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [invalidate, fps]);
  return null;
}

/**
 * Walks a closed loop of stops, resting at each one. Returns where the walker
 * is at a given time, which way it faces, and how far into its rest it is.
 */
function useRoute(stops: Stop[], speed: number, rest: number, delay = 0) {
  return useMemo(() => {
    const legs = stops.map((from, i) => {
      const to = stops[(i + 1) % stops.length];
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
      return { from, to, len, time: len / speed, heading: Math.atan2(to[0] - from[0], to[1] - from[1]) };
    });
    const total = legs.reduce((sum, l) => sum + l.time + rest, 0);
    return (clock: number) => {
      let t = (((clock - delay) % total) + total) % total;
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        if (t < leg.time) {
          const k = t / leg.time;
          return { x: leg.from[0] + (leg.to[0] - leg.from[0]) * k, z: leg.from[1] + (leg.to[1] - leg.from[1]) * k, heading: leg.heading, walked: t * speed, resting: -1 };
        }
        t -= leg.time;
        if (t < rest) return { x: leg.to[0], z: leg.to[1], heading: t > rest * 0.7 ? legs[(i + 1) % legs.length].heading : leg.heading, walked: 0, resting: t / rest };
        t -= rest;
      }
      const l = legs[0];
      return { x: l.from[0], z: l.from[1], heading: l.heading, walked: 0, resting: 0 };
    };
  }, [stops, speed, rest, delay]);
}

function turnToward(current: number, target: number, k: number) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * k;
}

/* ------------------------------------------------------------------ */
/* Animals                                                             */
/* ------------------------------------------------------------------ */

type Plumage = { body: string; wing: string; tail: string; neck?: string };

const HEN_WHITE: Plumage = { body: "#f6f1e6", wing: "#e6ddca", tail: "#efe7d6" };
const HEN_RED: Plumage = { body: "#b5562a", wing: "#8f3f1d", tail: "#5c2a16" };
const HEN_SPECKLED: Plumage = { body: "#4a4844", wing: "#2f2d2b", tail: "#1f1e1d", neck: "#d9d4c8" };
const ROOSTER: Plumage = { body: "#c9461f", wing: "#1f4d3a", tail: "#12332b", neck: "#f0a73a" };

function Chicken({ route, speed = 2.2, rest = 3, delay = 0, plumage, rooster = false, size = 1 }: { route: Stop[]; speed?: number; rest?: number; delay?: number; plumage: Plumage; rooster?: boolean; size?: number }) {
  const at = useRoute(route, speed, rest, delay);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const p = at(clock.elapsedTime);
    const g = root.current!;
    g.position.set(p.x, 0, p.z);
    g.rotation.y = turnToward(g.rotation.y, p.heading, Math.min(1, dt * 6));
    const stride = p.walked * 2.6;
    const walking = p.resting < 0;
    legL.current!.rotation.x = walking ? Math.sin(stride) * 0.7 : 0;
    legR.current!.rotation.x = walking ? -Math.sin(stride) * 0.7 : 0;
    body.current!.position.y = walking ? Math.abs(Math.sin(stride)) * 0.08 : 0;
    // Walking: the head juts forward with each step. Resting: peck at the ground.
    const peck = !walking && p.resting > 0.12 && p.resting < 0.68 ? Math.max(0, Math.sin((p.resting - 0.12) * Math.PI * 9)) : 0;
    head.current!.rotation.x = walking ? Math.sin(stride * 2) * 0.12 : peck * 1.25;
    body.current!.rotation.x = peck * 0.28;
  });
  const leg = "#e8a12a";
  const comb = "#d92323";
  return (
    <group ref={root} scale={size * (rooster ? 1.2 : 1)}>
      <BlobShadow size={[1.5, 1.9]} />
      <group ref={body}>
        <group position={[0, 1.55, 0]}>
          <mesh scale={[0.92, 0.9, 1.25]} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial color={plumage.body} roughness={0.85} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.78, 0.05, -0.1]} rotation={[0.15, 0, s * 0.12]} scale={[0.22, 0.6, 0.95]}>
              <sphereGeometry args={[1, 14, 10]} />
              <meshStandardMaterial color={plumage.wing} roughness={0.9} />
            </mesh>
          ))}
          {/* Tail feathers fan up and back. */}
          {(rooster ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3]).map((a) => (
            <mesh key={a} position={[a * 0.5, rooster ? 0.95 : 0.6, -1.15]} rotation={[rooster ? -0.75 : -0.55, 0, a * 0.5]} scale={[0.16, rooster ? 1.15 : 0.7, 0.4]}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={plumage.tail} roughness={0.7} />
            </mesh>
          ))}
          {/* Neck, head, comb, beak and wattle swing together when it pecks. */}
          <group ref={head} position={[0, 0.25, 0.85]}>
            <mesh position={[0, 0.5, 0.12]} rotation={[0.25, 0, 0]} scale={[0.42, 0.75, 0.42]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={plumage.neck ?? plumage.body} roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.08, 0.28]}>
              <sphereGeometry args={[0.38, 14, 12]} />
              <meshStandardMaterial color={plumage.neck ?? plumage.body} roughness={0.85} />
            </mesh>
            {[0.14, 0.32, 0.5].map((z, i) => (
              <mesh key={z} position={[0, 1.46 + (i === 1 ? 0.06 : 0), z - 0.02]} scale={[0.07, rooster ? 0.26 : 0.16, 0.13]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color={comb} roughness={0.5} />
              </mesh>
            ))}
            <mesh position={[0, 1.02, 0.72]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 0.36, 8]} />
              <meshStandardMaterial color="#f2b632" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.78, 0.56]} scale={[0.08, rooster ? 0.22 : 0.14, 0.1]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial color={comb} roughness={0.5} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.3, 1.14, 0.44]}>
                <sphereGeometry args={[0.055, 8, 8]} />
                <meshStandardMaterial color="#141210" roughness={0.2} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      {[
        [-0.34, legL],
        [0.34, legR],
      ].map(([x, ref]) => (
        <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.85, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.85, 6]} />
            <meshStandardMaterial color={leg} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.83, 0.16]} scale={[0.3, 0.05, 0.42]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={leg} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A chick trailing behind its mother on the same route. */
function Chick({ route, speed, rest, delay, offset }: { route: Stop[]; speed: number; rest: number; delay: number; offset: [number, number] }) {
  const at = useRoute(route, speed, rest, delay);
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const p = at(clock.elapsedTime);
    const g = root.current!;
    g.position.set(p.x + offset[0], p.resting < 0 ? Math.abs(Math.sin(p.walked * 7)) * 0.12 : 0, p.z + offset[1]);
    g.rotation.y = turnToward(g.rotation.y, p.heading, Math.min(1, dt * 6));
  });
  return (
    <group ref={root}>
      <BlobShadow size={[0.55, 0.6]} opacity={0.28} />
      <mesh position={[0, 0.48, 0]} scale={[0.9, 0.9, 1.05]}>
        <sphereGeometry args={[0.4, 12, 10]} />
        <meshStandardMaterial color="#ffd84a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.88, 0.26]}>
        <sphereGeometry args={[0.25, 12, 10]} />
        <meshStandardMaterial color="#ffe06a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.86, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.18, 6]} />
        <meshStandardMaterial color="#f08a24" roughness={0.5} />
      </mesh>
    </group>
  );
}

function HenWithChicks({ route, plumage, delay = 0, rest = 3.4 }: { route: Stop[]; plumage: Plumage; delay?: number; rest?: number }) {
  const speed = 1.9;
  return (
    <>
      <Chicken route={route} speed={speed} rest={rest} delay={delay} plumage={plumage} />
      <Chick route={route} speed={speed} rest={rest} delay={delay + 1.0} offset={[0.5, 0.2]} />
      <Chick route={route} speed={speed} rest={rest} delay={delay + 1.5} offset={[-0.6, -0.1]} />
      <Chick route={route} speed={speed} rest={rest} delay={delay + 2.1} offset={[0.2, -0.5]} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Buildings and yard furniture                                        */
/* ------------------------------------------------------------------ */

type HouseLook = { wall: THREE.Texture; trim: string; door: string; roofColor: string };

const HOUSE_W = 17;
const HOUSE_D = 11;
const HOUSE_H = 8.5;
const BASE = 0.9;

/** A one-room country house of upright boards on a low footing. */
function PlankHouse({ look }: { look: HouseLook }) {
  const walls = useMemo(() => {
    const mk = (repeatX: number) => {
      const t = look.wall.clone();
      t.repeat.set(repeatX, 1);
      t.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.82 });
    };
    return { front: mk(HOUSE_W / 6), side: mk(HOUSE_D / 6) };
  }, [look.wall]);
  const roofMat = useMemo(() => {
    const t = zincTexture(look.roofColor, look.roofColor, 1).clone();
    t.repeat.set(3, 1);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.5, roughness: 0.42, metalness: 0.55 });
  }, [look.roofColor]);
  const gable = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-HOUSE_D / 2, 0);
    s.lineTo(HOUSE_D / 2, 0);
    s.lineTo(0, 3.6);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  useEffect(() => () => {
    walls.front.dispose();
    walls.side.dispose();
    roofMat.dispose();
    gable.dispose();
  }, [walls, roofMat, gable]);

  const over = 1.3;
  const rise = 3.6;
  const run = HOUSE_D / 2 + over;
  const pitch = Math.atan2(rise, HOUSE_D / 2);
  const slope = run / Math.cos(pitch);
  const wallY = BASE + HOUSE_H / 2;
  const trim = <meshStandardMaterial color={look.trim} roughness={0.7} />;
  const doorTex = plankTexture(`door:${look.door}`, "#7a5232", look.door);

  return (
    <group>
      <BlobShadow size={[HOUSE_W * 0.75, HOUSE_D * 0.95]} opacity={0.5} />
      {/* Footing of rough stone. */}
      <mesh position={[0, BASE / 2, 0]}>
        <boxGeometry args={[HOUSE_W + 0.5, BASE, HOUSE_D + 0.5]} />
        <meshStandardMaterial color="#a39a8a" roughness={0.95} />
      </mesh>
      {/* Walls: +z is the front. */}
      <mesh position={[0, wallY, HOUSE_D / 2]} material={walls.front} castShadow>
        <boxGeometry args={[HOUSE_W, HOUSE_H, 0.3]} />
      </mesh>
      <mesh position={[0, wallY, -HOUSE_D / 2]} material={walls.front}>
        <boxGeometry args={[HOUSE_W, HOUSE_H, 0.3]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[(s * HOUSE_W) / 2, wallY, 0]} rotation={[0, Math.PI / 2, 0]} material={walls.side} castShadow>
            <boxGeometry args={[HOUSE_D, HOUSE_H, 0.3]} />
          </mesh>
          <mesh position={[s * (HOUSE_W / 2 + 0.16), BASE + HOUSE_H, 0]} rotation={[0, (s * Math.PI) / 2, 0]} geometry={gable} material={walls.side} />
          {/* Corner posts. */}
          {[-1, 1].map((f) => (
            <mesh key={f} position={[s * (HOUSE_W / 2 + 0.05), wallY, f * (HOUSE_D / 2 + 0.05)]}>
              <boxGeometry args={[0.55, HOUSE_H, 0.55]} />
              {trim}
            </mesh>
          ))}
        </group>
      ))}

      {/* Door, a little ajar, with a step up to it. */}
      <group position={[0, BASE, HOUSE_D / 2 + 0.2]}>
        <mesh position={[0, 3.1, 0]}>
          <boxGeometry args={[3.7, 6.5, 0.2]} />
          {trim}
        </mesh>
        <mesh position={[0, 3.0, 0.06]}>
          <boxGeometry args={[3.0, 6.0, 0.2]} />
          <meshStandardMaterial color="#1c140e" roughness={1} />
        </mesh>
        <group position={[-1.5, 0, 0.12]} rotation={[0, -0.5, 0]}>
          <mesh position={[1.5, 3.0, 0]} castShadow>
            <boxGeometry args={[3.0, 6.0, 0.18]} />
            <meshStandardMaterial map={doorTex} roughness={0.75} />
          </mesh>
        </group>
        <mesh position={[0, -0.45, 1.4]}>
          <boxGeometry args={[4.6, 0.45, 2.2]} />
          <meshStandardMaterial color="#b5ad9d" roughness={0.95} />
        </mesh>
      </group>
      {/* Windows with board shutters thrown open. */}
      {[-5.6, 5.6].map((x) => (
        <group key={x} position={[x, BASE + 5.0, HOUSE_D / 2 + 0.2]}>
          <mesh>
            <boxGeometry args={[3.0, 3.4, 0.2]} />
            {trim}
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[2.4, 2.8, 0.2]} />
            <meshStandardMaterial color="#20170f" roughness={1} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 1.25, 0, 0.14]} rotation={[0, s * 1.15, 0]}>
              <mesh position={[s * 0.62, 0, 0]} castShadow>
                <boxGeometry args={[1.25, 2.9, 0.14]} />
                <meshStandardMaterial map={doorTex} roughness={0.75} />
              </mesh>
            </group>
          ))}
          {/* Flower box. */}
          <mesh position={[0, -1.95, 0.5]}>
            <boxGeometry args={[2.8, 0.55, 0.75]} />
            <meshStandardMaterial color="#8a5a36" roughness={0.9} />
          </mesh>
          {[-0.9, -0.3, 0.3, 0.9].map((fx, i) => (
            <mesh key={fx} position={[fx, -1.5, 0.55]}>
              <sphereGeometry args={[0.36, 10, 8]} />
              <meshStandardMaterial color={["#ff4f8b", "#ffcf3f", "#ff6b3d", "#ffffff"][i]} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Roof. */}
      {[-1, 1].map((s) => (
            <mesh key={s} position={[0, BASE + HOUSE_H + rise / 2 - (over * Math.tan(pitch)) / 2 + 0.2, (s * run) / 2]} rotation={[s * pitch, 0, 0]} material={roofMat} castShadow>
              <boxGeometry args={[HOUSE_W + over * 2, 0.16, slope]} />
            </mesh>
          ))}
          <mesh position={[0, BASE + HOUSE_H + rise + 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.3, 0.3, HOUSE_W + over * 2, 10]} />
            <meshStandardMaterial color="#c9ccd0" roughness={0.4} metalness={0.7} />
          </mesh>
    </group>
  );
}

function Fence({ from, to }: { from: Stop; to: Stop }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const turn = Math.atan2(-(to[1] - from[1]), to[0] - from[0]);
  const white = <meshStandardMaterial color="#f6f3ea" roughness={0.75} />;
  const pickets = Math.round(len / 0.95);
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation={[0, turn, 0]}>
      {[1.2, 2.6].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[len, 0.3, 0.16]} />
          {white}
        </mesh>
      ))}
      {Array.from({ length: pickets }, (_, i) => (
        <mesh key={i} position={[-len / 2 + (i + 0.5) * (len / pickets), 1.8, 0.14]} castShadow>
          <boxGeometry args={[0.55, 3.6, 0.12]} />
          {white}
        </mesh>
      ))}
    </group>
  );
}

/** Broad shade tree: a short trunk and a canopy of overlapping clumps. */
function MangoTree() {
  const leaves = leafTexture("#2f8a3a", "#58b24a");
  const rnd = rng(9);
  const clumps = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 13) * Math.PI * 2;
    const d = i < 9 ? 5.2 : 2.2;
    return { p: [Math.cos(a) * d * (0.8 + rnd() * 0.4), 15 + rnd() * 3 + (i >= 9 ? 2.5 : 0), Math.sin(a) * d * (0.8 + rnd() * 0.4)] as [number, number, number], r: 3.6 + rnd() * 1.6 };
  });
  return (
    <group>
      <mesh position={[0, 6, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.5, 12, 10]} />
        <meshStandardMaterial color="#6a4a30" roughness={1} />
      </mesh>
      {clumps.map((c, i) => (
        <mesh key={i} position={c.p} scale={[1, 0.8, 1]}>
          <icosahedronGeometry args={[c.r, 2]} />
          <meshStandardMaterial map={leaves} roughness={0.9} />
        </mesh>
      ))}
      {/* A few mangoes hanging low. */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.4) * 4.6, 11.8 + (i % 2) * 0.5, Math.sin(i * 1.4) * 4.6]} scale={[0.5, 0.65, 0.5]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={i % 2 ? "#ffb23b" : "#f47b3a"} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function BananaPlant() {
  const leaf = leafTexture("#2f8f35", "#52b043");
  return (
    <group>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.45, 0.7, 6.4, 10]} />
        <meshStandardMaterial color="#6f9a48" roughness={0.9} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={[0, 6.2, 0]} rotation={[0, (i / 7) * Math.PI * 2, 0]}>
          <mesh position={[2.6, 0.9 - (i % 2) * 0.7, 0]} rotation={[0, 0, 0.25 - (i % 2) * 0.55]} scale={[3.0, 0.08, 1.05]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial map={leaf} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FlowerPot({ color }: { color: string }) {
  return (
    <group>
      <BlobShadow size={[1.2, 1.2]} />
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.85, 0.6, 1.4, 14]} />
        <meshStandardMaterial color="#c0643c" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.9, 0]} scale={[1, 0.85, 1]}>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshStandardMaterial color="#3f9a40" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.05) * 0.8, 2.2 + (i % 2) * 0.4, Math.sin(i * 1.05) * 0.8]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** A hollowed log of feed with corn in it. */
function Trough() {
  return (
    <group>
      <BlobShadow size={[1.6, 3.4]} />
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[2.2, 0.8, 5.6]} />
        <meshStandardMaterial map={plankTexture("trough", "#8a6240")} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[1.5, 0.1, 4.9]} />
        <meshStandardMaterial color="#f2c53d" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The yard                                                            */
/* ------------------------------------------------------------------ */

const BRIGHT_ROUTES: Record<string, Stop[]> = {
  white: [[-24, 7], [-19, 10], [-22, 13], [-26, 11]],
  door: [[-17, -9], [-21, -6], [-24, -9], [-19, -12]],
  red: [[19, 8], [25, 9], [24, 13], [18, 12]],
  // The long way round the table, past every seat.
  speckled: [[-25, -3], [-26, 6], [-18, 15], [0, 18], [19, 15], [26, 5], [24, -8], [8, -21], [-8, -21]],
  rooster: [[18, -10], [23, -13], [25, -8], [20, -16]],
};

/** Painted casita with a zinc roof, hens in a swept yard, midday sun. */
function BrightYard() {
  const { house, tree, trough } = YARD;
  const look = useMemo<HouseLook>(() => ({ wall: plankTexture("turquoise", "#8a6a48", "#27b3ad"), trim: "#fbf8ef", door: "#ff6f59", roofColor: "#c2402c" }), []);
  return (
    <group position={[0, FLOOR_Y, 0]}>
      <AmbientFrames />
      <group position={[house.x, 0, house.z]} rotation={[0, house.turn, 0]}>
        <PlankHouse look={look} />
        <group position={[-6.5, 0, 8.2]}>
          <FlowerPot color="#ff4f8b" />
        </group>
        <group position={[6.6, 0, 8.4]}>
          <FlowerPot color="#ffd23f" />
        </group>
        <group position={[-11.5, 0, 3]}>
          <BananaPlant />
        </group>
      </group>
      <group position={[tree.x, 0, tree.z]}>
        <MangoTree />
      </group>
      {[[22, -19, 1], [27, -14, 0.8], [17, -22, 0.7]].map(([x, z, k]) => (
        <group key={x} position={[x, 0, z]} rotation={[0, x, 0]} scale={k}>
          <BananaPlant />
        </group>
      ))}
      <group position={[trough.x, 0, trough.z]} rotation={[0, 0.5, 0]}>
        <Trough />
      </group>
      <Fence from={[36, -8]} to={[36, 24]} />
      <Fence from={[-12, -31]} to={[20, -31]} />
      <Chicken route={BRIGHT_ROUTES.white} plumage={HEN_WHITE} />
      <HenWithChicks route={BRIGHT_ROUTES.red} plumage={HEN_RED} delay={2} />
      <Chicken route={BRIGHT_ROUTES.speckled} plumage={HEN_SPECKLED} delay={5} speed={2.8} rest={2} />
      <Chicken route={BRIGHT_ROUTES.rooster} plumage={ROOSTER} rooster delay={1} rest={4} />
      <Chicken route={BRIGHT_ROUTES.door} plumage={HEN_RED} delay={9} size={0.92} />
    </group>
  );
}

export function Countryside() {
  return <BrightYard />;
}
