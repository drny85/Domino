/**
 * Ground and sky for the two countryside surroundings. The solid objects
 * (house, animals, fences) live in components/3d/Countryside.tsx; the spots
 * below line up with them. Ground coordinates are in table units: the square
 * is 90 wide, x to the right and z toward the player.
 */

type Ctx = CanvasRenderingContext2D;

const GROUND = 90;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Where the solid objects stand, shared with the 3D side. */
export const YARD = {
  bright: {
    house: { x: -27, z: -19, turn: 0.5 },
    tree: { x: 38, z: -30 },
    trough: { x: -27, z: 8 },
  },
  ranch: {
    house: { x: 27, z: -19, turn: -0.5 },
    palm: { x: -29, z: -20 },
    hay: { x: 27, z: 11 },
  },
} as const;

function blob(ctx: Ctx, cx: number, cy: number, r: number, seed: number, wobble = 0.18) {
  const rnd = rng(seed);
  const n = 22;
  const radii = Array.from({ length: n }, () => r * (1 - wobble + rnd() * wobble * 2));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const a2 = ((i + 0.5) / n) * Math.PI * 2;
    const r1 = radii[i % n];
    const r2 = (radii[i % n] + radii[(i + 1) % n]) / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.quadraticCurveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2);
  }
  ctx.closePath();
}

function blades(ctx: Ctx, s: number, seed: number, count: number, colors: string[], len: number) {
  const rnd = rng(seed);
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const l = len * (0.5 + rnd());
    ctx.strokeStyle = colors[Math.floor(rnd() * colors.length)];
    ctx.lineWidth = Math.max(1, l * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * l * 0.7, y - l);
    ctx.stroke();
  }
}

function dots(ctx: Ctx, s: number, seed: number, count: number, colors: string[], maxR: number, within?: (x: number, y: number) => boolean) {
  const rnd = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const r = 0.5 + rnd() * maxR;
    const c = colors[Math.floor(rnd() * colors.length)];
    if (within && !within(x, y)) continue;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Packed earth with soft, uneven edges. */
function earth(ctx: Ctx, cx: number, cy: number, r: number, seed: number, inner: string, outer: string) {
  ctx.save();
  ctx.filter = `blur(${Math.round(r * 0.07)}px)`;
  ctx.fillStyle = outer;
  blob(ctx, cx, cy, r, seed);
  ctx.fill();
  ctx.fillStyle = inner;
  blob(ctx, cx, cy, r * 0.8, seed + 3);
  ctx.fill();
  ctx.restore();
}

function softShade(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha: number, turn = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1);
  g.addColorStop(0, `rgba(20,14,6,${alpha})`);
  g.addColorStop(1, "rgba(20,14,6,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Flat stones leading from one spot to another. */
function steppingStones(ctx: Ctx, from: [number, number], to: [number, number], size: number, seed: number, color: string) {
  const rnd = rng(seed);
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const n = Math.max(3, Math.round(Math.hypot(dx, dy) / (size * 2.4)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = from[0] + dx * t + (rnd() - 0.5) * size * 0.9;
    const y = from[1] + dy * t + (rnd() - 0.5) * size * 0.9;
    ctx.fillStyle = "rgba(40,28,14,0.28)";
    blob(ctx, x + size * 0.12, y + size * 0.15, size, seed + i * 7, 0.12);
    ctx.fill();
    ctx.fillStyle = color;
    blob(ctx, x, y, size, seed + i * 7, 0.12);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    blob(ctx, x - size * 0.15, y - size * 0.18, size * 0.55, seed + i * 11, 0.2);
    ctx.fill();
  }
}

function skyAndHills(ctx: Ctx, w: number, h: number, top: string, bottom: string, hills: string[], sun: string, sunX: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * sunX, h * 0.42, 0, w * sunX, h * 0.42, h * 0.5);
  glow.addColorStop(0, sun);
  glow.addColorStop(0.12, sun);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  hills.forEach((color, i) => {
    const base = h * (0.56 + i * 0.11);
    const amp = h * (0.1 - i * 0.025);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base - Math.sin((x / w) * Math.PI * 2 + i * 1.7) * amp - Math.sin((x / w) * Math.PI * 5 + i) * amp * 0.3);
    ctx.lineTo(w, h);
    ctx.fill();
  });
}

/** Option A: a bright midday yard in front of a painted plank house. */
export function brightYardFloor(ctx: Ctx, s: number) {
  const u = s / GROUND;
  const px = (x: number) => (x + GROUND / 2) * u;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, "#7cc253");
  g.addColorStop(1, "#5aa843");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // Lighter and darker drifts so the lawn is not one flat colour.
  const rnd = rng(11);
  ctx.save();
  ctx.filter = `blur(${Math.round(u * 2.5)}px)`;
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rnd() > 0.5 ? "rgba(150,214,96,0.35)" : "rgba(52,128,52,0.3)";
    blob(ctx, rnd() * s, rnd() * s, u * (3 + rnd() * 6), 100 + i);
    ctx.fill();
  }
  ctx.restore();
  blades(ctx, s, 5, 26000, ["#4f9a3c", "#8fd163", "#3f8a35", "#a4dc72", "#6db84c"], u * 0.9);

  // The yard: swept red earth under the table, reaching to the house door.
  const { house, tree, trough } = YARD.bright;
  earth(ctx, px(0), px(1), u * 25, 31, "#bd8652", "#a87245");
  earth(ctx, px(house.x + 5), px(house.z + 9), u * 9, 37, "#bd8652", "#a87245");
  earth(ctx, px(trough.x), px(trough.z), u * 7, 41, "#bd8652", "#a87245");
  const inYard = (x: number, y: number) => Math.hypot(x - px(0), y - px(1)) < u * 22;
  dots(ctx, s, 13, 9000, ["#a06c40", "#cc9c6a", "#95633a", "#d4a877"], u * 0.16, inYard);
  dots(ctx, s, 17, 500, ["#8d8578", "#b9b2a4", "#6f675b"], u * 0.3, inYard);
  // Tufts creeping in at the edge of the earth.
  dots(ctx, s, 19, 1400, ["#5fae45", "#6db84c"], u * 0.35, (x, y) => {
    const d = Math.hypot(x - px(0), y - px(1));
    return d > u * 19 && d < u * 25;
  });
  steppingStones(ctx, [px(-13), px(-11)], [px(house.x + 6), px(house.z + 9)], u * 1.5, 51, "#c9c3b4");
  // Corn scattered for the hens.
  dots(ctx, s, 23, 2600, ["#ffd23f", "#f6b92b", "#fff0a8"], u * 0.14, (x, y) => Math.hypot(x - px(trough.x + 2), y - px(trough.z + 1)) < u * 6);
  // Wild flowers in the grass.
  const far = (x: number, y: number) => Math.hypot(x - px(0), y - px(1)) > u * 26;
  dots(ctx, s, 29, 700, ["#ffe14d", "#ffffff", "#ff7fae", "#ffb03b"], u * 0.16, far);
  // Shade: under the mango tree, the house and the table.
  softShade(ctx, px(tree.x - 5), px(tree.z + 5), u * 12, u * 10, 0.4);
  softShade(ctx, px(house.x - 2), px(house.z - 2), u * 14, u * 10, 0.4, -house.turn);
  softShade(ctx, s / 2, s / 2, u * 20, u * 20, 0.3);
}

export function brightYardBackdrop(ctx: Ctx, w: number, h: number) {
  skyAndHills(ctx, w, h, "#4fa8ec", "#d6f0fb", ["#93cfa1", "#73ba68", "#5aa843"], "rgba(255,250,214,0.95)", 0.74);
  const rnd = rng(7);
  for (let i = 0; i < 5; i++) {
    const x = rnd() * w;
    const y = h * (0.1 + rnd() * 0.2);
    const r = h * (0.04 + rnd() * 0.03);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (const [dx, dy, k] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.7], [0.4, -0.45, 0.75]]) {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, k * r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Option B: a ranch at golden hour, dry grass and long warm light. */
export function ranchFloor(ctx: Ctx, s: number) {
  const u = s / GROUND;
  const px = (x: number) => (x + GROUND / 2) * u;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, "#c9b45e");
  g.addColorStop(1, "#b39a4a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const rnd = rng(61);
  ctx.save();
  ctx.filter = `blur(${Math.round(u * 2.5)}px)`;
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rnd() > 0.55 ? "rgba(120,160,70,0.4)" : "rgba(226,200,116,0.4)";
    blob(ctx, rnd() * s, rnd() * s, u * (3 + rnd() * 6), 300 + i);
    ctx.fill();
  }
  ctx.restore();
  blades(ctx, s, 67, 24000, ["#d9c46c", "#a8943f", "#e6d58a", "#8aa24a", "#bfa850"], u * 1.0);

  const { house, palm, hay } = YARD.ranch;
  earth(ctx, px(0), px(1), u * 26, 71, "#b9824f", "#a26c3f");
  earth(ctx, px(house.x - 5), px(house.z + 9), u * 10, 73, "#b9824f", "#a26c3f");
  earth(ctx, px(hay.x), px(hay.z), u * 8, 79, "#b17a48", "#a26c3f");
  // Cart ruts running out of the yard toward the near right corner.
  ctx.lineCap = "round";
  for (const off of [-1.6, 1.6]) {
    ctx.strokeStyle = "rgba(96,58,30,0.45)";
    ctx.lineWidth = u * 0.9;
    ctx.beginPath();
    ctx.moveTo(px(14 + off), px(14));
    ctx.bezierCurveTo(px(22 + off), px(22), px(26 + off), px(34), px(40 + off), px(45));
    ctx.stroke();
  }
  const inYard = (x: number, y: number) => Math.hypot(x - px(0), y - px(1)) < u * 23;
  dots(ctx, s, 83, 9000, ["#96633a", "#c9955f", "#8a5a34", "#d6a674"], u * 0.16, inYard);
  dots(ctx, s, 89, 600, ["#7d7466", "#a69d8c", "#5e5648"], u * 0.3, inYard);
  // Loose straw around the bales.
  const r2 = rng(97);
  ctx.strokeStyle = "#ecd27a";
  ctx.lineWidth = Math.max(1, u * 0.08);
  for (let i = 0; i < 700; i++) {
    const a = r2() * Math.PI * 2;
    const d = r2() * u * 8;
    const x = px(hay.x) + Math.cos(a) * d;
    const y = px(hay.z) + Math.sin(a) * d;
    const t = r2() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(t) * u * 0.7, y + Math.sin(t) * u * 0.7);
    ctx.stroke();
  }
  steppingStones(ctx, [px(13), px(-11)], [px(house.x - 6), px(house.z + 9)], u * 1.5, 101, "#b3a892");
  // Long evening shade.
  softShade(ctx, px(palm.x + 3), px(palm.z + 2), u * 9, u * 8, 0.4);
  softShade(ctx, px(house.x - 4), px(house.z - 3), u * 16, u * 10, 0.45, -house.turn);
  softShade(ctx, s / 2 - u * 3, s / 2 - u * 2, u * 22, u * 20, 0.34);
  // Warm wash over everything.
  ctx.fillStyle = "rgba(255,170,70,0.07)";
  ctx.fillRect(0, 0, s, s);
}

export function ranchBackdrop(ctx: Ctx, w: number, h: number) {
  skyAndHills(ctx, w, h, "#f39a55", "#ffe3a8", ["#c99a6a", "#a8894f", "#b39a4a"], "rgba(255,236,170,1)", 0.3);
  ctx.fillStyle = "rgba(255,214,170,0.75)";
  for (const [x, y, rw] of [[0.15, 0.2, 0.16], [0.5, 0.14, 0.2], [0.82, 0.24, 0.14]]) {
    ctx.beginPath();
    ctx.ellipse(w * x, h * y, w * rw, h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
