import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Shared looks for the table set: polished ivory tiles, their backs and the
 * small painted textures that give surfaces depth. Everything is drawn with
 * the 2D canvas API once and reused, so nothing is downloaded.
 */

/** Polished ivory resin: bright, with a hard glossy coat like a real set. */
export const IVORY = {
  color: "#fbf6ea",
  roughness: 0.26,
  clearcoat: 1,
  clearcoatRoughness: 0.09,
  sheen: 0.15,
} as const;

/** A slightly different shade per tile, as in a real set that has seen some play. */
export function ivoryTint(a: number, b: number) {
  const n = Math.sin((a * 7 + b * 13 + 1) * 12.9898) * 43758.5453;
  const jitter = (n - Math.floor(n) - 0.5) * 0.035;
  return new THREE.Color(IVORY.color).offsetHSL(0.004 * jitter * 20, 0, jitter);
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

const cache = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

/** A face-down tile with the same rounded edges as a face-up one. */
export function tileBackGeometry(width: number, height: number, depth: number) {
  return once(`back:${width}:${height}:${depth}`, () => new RoundedBoxGeometry(width, height, depth, 4, 0.06));
}

export function tileBackMaterial() {
  return once("backMat", () => new THREE.MeshPhysicalMaterial({ ...IVORY }));
}

/**
 * The top of a pip: a drilled, painted dimple. The rim catches a shadow on
 * one side and light on the other, and the paint shows a small glint.
 */
export function pipTexture() {
  return once("pip", () => {
    const s = 96;
    const [c, ctx] = canvas(s, s);
    const m = s / 2;
    // Bevel where the drill broke the surface.
    const rim = ctx.createLinearGradient(0, 0, s, s);
    rim.addColorStop(0, "#8f8672");
    rim.addColorStop(1, "#f2ead8");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(m, m, m, 0, Math.PI * 2);
    ctx.fill();
    // Painted bowl, darker toward the lit side's shadowed wall.
    const bowl = ctx.createRadialGradient(m + 6, m + 8, 2, m, m, m * 0.86);
    bowl.addColorStop(0, "#2b2b31");
    bowl.addColorStop(0.7, "#141417");
    bowl.addColorStop(1, "#050506");
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.arc(m, m, m * 0.86, 0, Math.PI * 2);
    ctx.fill();
    // Glint.
    const glint = ctx.createRadialGradient(m - 13, m - 15, 0, m - 13, m - 15, 13);
    glint.addColorStop(0, "rgba(255,255,255,0.55)");
    glint.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(m - 13, m - 15, 13, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
}

/** Soft dark patch that sits under a tile lying on the felt. */
export function contactShadowTexture() {
  return once("contact", () => {
    const w = 128;
    const h = 224;
    const [c, ctx] = canvas(w, h);
    // Read as an alpha map: white is shadow, black is clear.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.filter = "blur(7px)";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(17, 17, w - 34, h - 34, 8);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    return tex;
  });
}

/** Woven nap for the playing surface: fine noise used as a height map. */
export function feltBumpTexture() {
  return once("felt", () => {
    const s = 256;
    const [c, ctx] = canvas(s, s);
    const img = ctx.createImageData(s, s);
    let seed = 91;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + rnd() * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Short fibres lying in every direction.
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const a = rnd() * Math.PI;
      const l = 2 + rnd() * 5;
      ctx.strokeStyle = rnd() > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    return tex;
  });
}

/** Brushed steel seen from above: fine rings, darker toward the middle of the well. */
export function cupWellTexture() {
  return once("cup", () => {
    const s = 256;
    const [c, ctx] = canvas(s, s);
    const m = s / 2;
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, "#8d949b");
    g.addColorStop(0.5, "#6b7279");
    g.addColorStop(0.82, "#3f454b");
    g.addColorStop(0.9, "#2a2e33");
    g.addColorStop(1, "#9aa1a8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let r = 4; r < m; r += 2.5) {
      ctx.strokeStyle = r % 5 < 2.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m, m, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
}
