/**
 * Surroundings for the table: a painted floor and a painted backdrop behind
 * the far side, plus the light and haze that go with them. Everything is
 * drawn with the 2D canvas API, so no image files are downloaded.
 */

type Ctx = CanvasRenderingContext2D;

export type Scene = {
  id: string;
  name: string;
  /** Sky or wall colour that the distance fades into. */
  haze: string;
  /** Extra ambient light: outdoor scenes are brighter than the game room. */
  ambient: number;
  /** Tint of the key light. */
  sun: string;
  /** Paints the ground into a size×size square. The top edge is the far side. */
  floor: (ctx: Ctx, size: number) => void;
  /** Paints what stands behind the far side of the table into w×h. */
  backdrop: (ctx: Ctx, w: number, h: number) => void;
};

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function speckle(ctx: Ctx, size: number, seed: number, count: number, colors: string[], maxR: number) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.beginPath();
    ctx.arc(r() * size, r() * size, 0.5 + r() * maxR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Soft shade under the table so it sits on the ground. */
function groundShade(ctx: Ctx, size: number, alpha = 0.35) {
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.24);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function sky(ctx: Ctx, w: number, h: number, top: string, bottom: string) {
  ctx.fillStyle = vgrad(ctx, 0, h, [
    [0, top],
    [1, bottom],
  ]);
  ctx.fillRect(0, 0, w, h);
}

function cloud(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const [dx, dy, r] of [
    [0, 0, 1],
    [0.9, 0.15, 0.8],
    [-0.9, 0.2, 0.7],
    [0.4, -0.45, 0.75],
    [-0.4, -0.3, 0.6],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function palmTree(ctx: Ctx, x: number, base: number, height: number, lean: number) {
  ctx.strokeStyle = "#6b4a2b";
  ctx.lineWidth = height * 0.06;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.quadraticCurveTo(x + lean * 0.3, base - height * 0.6, x + lean, base - height);
  ctx.stroke();
  const tx = x + lean;
  const ty = base - height;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI + (i % 2 ? 0.12 : -0.08);
    const len = height * (0.42 + (i % 3) * 0.05);
    ctx.strokeStyle = i % 2 ? "#2f8f3f" : "#1f7a34";
    ctx.lineWidth = height * 0.05;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.9 - len * 0.2, tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.35 + len * 0.3);
    ctx.stroke();
  }
}

function hill(ctx: Ctx, w: number, baseY: number, amp: number, phase: number, color: string, bottom: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, baseY - Math.sin((x / w) * Math.PI * 2 + phase) * amp - Math.sin((x / w) * Math.PI * 5 + phase * 2) * amp * 0.3);
  ctx.lineTo(w, bottom);
  ctx.fill();
}

export const SCENES: Scene[] = [
  {
    id: "room",
    name: "Game room",
    haze: "#120d0a",
    ambient: 0,
    sun: "#ffffff",
    floor: (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 20, s / 2, s / 2, s / 2);
      g.addColorStop(0, "#4a3424");
      g.addColorStop(0.45, "#2a1d15");
      g.addColorStop(1, "#120d0a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 2;
      for (let x = 0; x <= s; x += s / 45) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, s);
        ctx.stroke();
      }
    },
    backdrop: (ctx, w, h) => {
      ctx.fillStyle = vgrad(ctx, 0, h, [
        [0, "#120d0a"],
        [1, "#1d140f"],
      ]);
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: "countryside",
    name: "Countryside",
    haze: "#bfe3f5",
    ambient: 0.45,
    sun: "#fff3d6",
    floor: (ctx, s) => {
      ctx.fillStyle = vgrad(ctx, 0, s, [
        [0, "#6fae4e"],
        [1, "#4f9440"],
      ]);
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 3, 14000, ["#5da145", "#7dbb58", "#468a39", "#88c463"], 5);
      // A dirt path winding off to the far side.
      ctx.strokeStyle = "#b99564";
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.5);
      ctx.bezierCurveTo(s * 0.62, s * 0.3, s * 0.7, s * 0.25, s * 0.82, 0);
      ctx.stroke();
      // Worn earth where the table and chairs stand.
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s * 0.27);
      g.addColorStop(0, "#b08a5a");
      g.addColorStop(1, "rgba(176,138,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 9, 900, ["#ffe14d", "#ffffff", "#ff8fb1", "#f7f2a0"], 3);
      // A picnic blanket and a few hay bales nearby.
      ctx.save();
      ctx.translate(s * 0.72, s * 0.5);
      ctx.rotate(0.2);
      const q = s * 0.0125;
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          ctx.fillStyle = (i + j) % 2 ? "#ffffff" : "#d7263d";
          ctx.fillRect(i * q, j * q, q, q);
        }
      ctx.restore();
      for (const [x, y] of [
        [0.2, 0.42],
        [0.24, 0.47],
        [0.17, 0.5],
      ]) {
        ctx.fillStyle = "#e3c15a";
        ctx.beginPath();
        ctx.arc(s * x, s * y, s * 0.022, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#b9962f";
        ctx.lineWidth = s * 0.002;
        for (let r = 0.005; r < 0.022; r += 0.005) {
          ctx.beginPath();
          ctx.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      groundShade(ctx, s, 0.3);
    },
    backdrop: (ctx, w, h) => {
      sky(ctx, w, h, "#6db9ee", "#d9f1fb");
      ctx.fillStyle = "#fff6c4";
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.2, h * 0.07, 0, Math.PI * 2);
      ctx.fill();
      cloud(ctx, w * 0.2, h * 0.2, h * 0.06);
      cloud(ctx, w * 0.55, h * 0.13, h * 0.045);
      hill(ctx, w, h * 0.55, h * 0.1, 0.6, "#8fc7a0", h);
      hill(ctx, w, h * 0.66, h * 0.08, 2.2, "#6fb36a", h);
      hill(ctx, w, h * 0.78, h * 0.05, 4, "#5aa24c", h);
      // A small farmhouse and trees.
      const hx = w * 0.3;
      const hy = h * 0.7;
      ctx.fillStyle = "#f3e2c0";
      ctx.fillRect(hx, hy - h * 0.1, w * 0.07, h * 0.1);
      ctx.fillStyle = "#b5462f";
      ctx.beginPath();
      ctx.moveTo(hx - w * 0.008, hy - h * 0.1);
      ctx.lineTo(hx + w * 0.035, hy - h * 0.17);
      ctx.lineTo(hx + w * 0.078, hy - h * 0.1);
      ctx.fill();
      const r = rng(21);
      for (let i = 0; i < 16; i++) {
        const x = r() * w;
        const y = h * (0.68 + r() * 0.14);
        const t = h * (0.05 + r() * 0.05);
        ctx.fillStyle = "#5b3d24";
        ctx.fillRect(x - t * 0.07, y - t * 0.5, t * 0.14, t * 0.6);
        ctx.fillStyle = r() > 0.5 ? "#2f7d3a" : "#3c9146";
        ctx.beginPath();
        ctx.arc(x, y - t * 0.8, t * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#5aa24c";
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
    },
  },
  {
    id: "beach",
    name: "Beach",
    haze: "#bfe9f7",
    ambient: 0.55,
    sun: "#fff1cc",
    floor: (ctx, s) => {
      ctx.fillStyle = vgrad(ctx, 0, s, [
        [0, "#1c86b8"],
        [0.2, "#35b3d1"],
        [0.3, "#7fdbe0"],
        [0.34, "#f1e3bd"],
        [1, "#e6cf9c"],
      ]);
      ctx.fillRect(0, 0, s, s);
      // Foam along the waterline.
      for (const [y, a] of [
        [0.325, 0.9],
        [0.29, 0.5],
        [0.24, 0.35],
      ]) {
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = s * 0.008;
        ctx.beginPath();
        for (let x = 0; x <= s; x += 6) ctx.lineTo(x, s * y + Math.sin(x * 0.03 + y * 40) * s * 0.008);
        ctx.stroke();
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, s * 0.35, s, s);
      ctx.clip();
      speckle(ctx, s, 5, 12000, ["#dcc48c", "#f4e8c8", "#d2b77c"], 2.6);
      ctx.restore();
      // A towel, a ball and a few shells on the sand.
      ctx.save();
      ctx.translate(s * 0.2, s * 0.62);
      ctx.rotate(-0.25);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? "#ffffff" : "#e94f4f";
        ctx.fillRect(0, i * s * 0.012, s * 0.11, s * 0.012);
      }
      ctx.restore();
      const bx = s * 0.8;
      const by = s * 0.55;
      ["#f25c54", "#ffd166", "#3fa7d6", "#ffffff"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.arc(bx, by, s * 0.022, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2);
        ctx.fill();
      });
      // A beach umbrella seen from above.
      const ux = s * 0.24;
      const uy = s * 0.5;
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 ? "#ffffff" : "#f4a261";
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.arc(ux, uy, s * 0.055, (i * Math.PI) / 6, ((i + 1) * Math.PI) / 6);
        ctx.fill();
      }
      speckle(ctx, s, 31, 90, ["#fff7ea", "#f6c9b0", "#e9a48b"], 4);
      groundShade(ctx, s, 0.28);
    },
    backdrop: (ctx, w, h) => {
      sky(ctx, w, h, "#49a9e6", "#cdf0fb");
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.22, h * 0.08, 0, Math.PI * 2);
      ctx.fill();
      cloud(ctx, w * 0.62, h * 0.18, h * 0.055);
      cloud(ctx, w * 0.85, h * 0.3, h * 0.04);
      ctx.fillStyle = vgrad(ctx, h * 0.6, h, [
        [0, "#1470a6"],
        [1, "#1c86b8"],
      ]);
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
      // A far island and a sailboat on the horizon.
      ctx.fillStyle = "#3f8f6b";
      ctx.beginPath();
      ctx.ellipse(w * 0.72, h * 0.6, w * 0.09, h * 0.035, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(w * 0.45, h * 0.6);
      ctx.lineTo(w * 0.45, h * 0.5);
      ctx.lineTo(w * 0.48, h * 0.6);
      ctx.fill();
      palmTree(ctx, w * 0.08, h, h * 0.6, w * 0.04);
      palmTree(ctx, w * 0.93, h, h * 0.7, -w * 0.05);
    },
  },
  {
    id: "bodega",
    name: "Bodega",
    haze: "#3a2c22",
    ambient: 0.25,
    sun: "#ffe7bf",
    floor: (ctx, s) => {
      const n = 40;
      const c = s / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? "#e9e0cf" : "#b33a2e";
          ctx.fillRect(i * c, j * c, c, c);
        }
      ctx.strokeStyle = "rgba(60,40,30,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        ctx.moveTo(i * c, 0);
        ctx.lineTo(i * c, s);
        ctx.moveTo(0, i * c);
        ctx.lineTo(s, i * c);
        ctx.stroke();
      }
      speckle(ctx, s, 13, 900, ["rgba(0,0,0,0.06)", "rgba(255,255,255,0.05)"], 6);
      // Crates of fruit and stacked boxes around the shop floor, seen from above.
      const fr = rng(88);
      const crate = (x: number, y: number, fruit: string) => {
        const w = s * 0.05;
        ctx.fillStyle = "#8a5a2b";
        ctx.fillRect(x, y, w, w);
        ctx.fillStyle = "#6b4420";
        ctx.fillRect(x + w * 0.08, y + w * 0.08, w * 0.84, w * 0.84);
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = fruit;
          ctx.beginPath();
          ctx.arc(x + w * (0.2 + (i % 4) * 0.2), y + w * (0.2 + Math.floor(i / 4) * 0.2) + (fr() - 0.5) * 3, w * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      ["#f4a52a", "#e63946", "#7cb518", "#f7d23e"].forEach((f, i) => crate(s * (0.14 + i * 0.06), s * 0.26, f));
      ["#7cb518", "#f4a52a", "#e63946"].forEach((f, i) => crate(s * (0.7 + i * 0.06), s * 0.3, f));
      for (const [x, y, c2] of [
        [0.16, 0.58, "#c9a66b"],
        [0.2, 0.62, "#b8935a"],
        [0.8, 0.56, "#c9a66b"],
      ] as [number, number, string][]) {
        ctx.fillStyle = c2;
        ctx.fillRect(s * x, s * y, s * 0.045, s * 0.045);
        ctx.strokeStyle = "rgba(90,60,30,0.6)";
        ctx.lineWidth = s * 0.003;
        ctx.strokeRect(s * x, s * y, s * 0.045, s * 0.045);
      }
      groundShade(ctx, s, 0.4);
    },
    backdrop: (ctx, w, h) => {
      ctx.fillStyle = "#e8d9b8";
      ctx.fillRect(0, 0, w, h);
      // Striped awning with the shop sign.
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = i % 2 ? "#f6f1e4" : "#1f8a4c";
        ctx.fillRect((i * w) / 24, 0, w / 24 + 1, h * 0.12);
      }
      ctx.fillStyle = "#c4322b";
      ctx.fillRect(w * 0.36, h * 0.14, w * 0.28, h * 0.11);
      ctx.fillStyle = "#fff6d8";
      ctx.font = `900 ${h * 0.085}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BODEGA", w / 2, h * 0.198);
      // Shelves stocked with cans, boxes and bottles.
      const r = rng(77);
      const colors = ["#d7263d", "#f49d37", "#3f88c5", "#2e933c", "#f2e94e", "#8e44ad", "#ffffff", "#e36414"];
      for (let row = 0; row < 4; row++) {
        const y = h * (0.42 + row * 0.13);
        let x = w * 0.02;
        while (x < w * 0.98) {
          const iw = w * (0.012 + r() * 0.016);
          const ih = h * (0.05 + r() * 0.05);
          ctx.fillStyle = colors[Math.floor(r() * colors.length)];
          ctx.fillRect(x, y - ih, iw, ih);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(x, y - ih * 0.62, iw, ih * 0.22);
          x += iw + w * 0.004;
        }
        ctx.fillStyle = "#6b4a2b";
        ctx.fillRect(0, y, w, h * 0.018);
      }
      ctx.fillStyle = "#5b3d24";
      ctx.fillRect(0, h * 0.9, w, h * 0.1);
    },
  },
  {
    id: "pool",
    name: "Pool",
    haze: "#c9ecf8",
    ambient: 0.55,
    sun: "#fff6e0",
    floor: (ctx, s) => {
      // Stone pavers.
      ctx.fillStyle = "#e3dccd";
      ctx.fillRect(0, 0, s, s);
      const n = 30;
      const c = s / n;
      const r = rng(41);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = `rgba(${150 + r() * 40},${140 + r() * 40},${120 + r() * 40},${0.12 + r() * 0.12})`;
          ctx.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
        }
      // The pool along the far side, with coping, lane tiles and ripples.
      const py = s * 0.05;
      const ph = s * 0.24;
      ctx.fillStyle = "#f6f3ea";
      ctx.fillRect(s * 0.1, py - s * 0.012, s * 0.8, ph + s * 0.024);
      ctx.fillStyle = vgrad(ctx, py, py + ph, [
        [0, "#1ea6d6"],
        [1, "#5fd3ea"],
      ]);
      ctx.fillRect(s * 0.112, py, s * 0.776, ph);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = s * 0.004;
      for (let k = 0; k < 9; k++) {
        ctx.beginPath();
        for (let x = s * 0.12; x <= s * 0.88; x += 6) ctx.lineTo(x, py + ph * (0.1 + k * 0.1) + Math.sin(x * 0.05 + k * 1.7) * s * 0.005);
        ctx.stroke();
      }
      // A float ring and a lounger.
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = s * 0.012;
      ctx.beginPath();
      ctx.arc(s * 0.7, py + ph * 0.5, s * 0.025, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#2a9d8f";
      ctx.fillRect(s * 0.14, s * 0.56, s * 0.05, s * 0.13);
      ctx.fillStyle = "#e9f5f3";
      ctx.fillRect(s * 0.145, s * 0.565, s * 0.04, s * 0.03);
      groundShade(ctx, s, 0.3);
    },
    backdrop: (ctx, w, h) => {
      sky(ctx, w, h, "#55b3ee", "#d6f2fc");
      cloud(ctx, w * 0.3, h * 0.18, h * 0.055);
      cloud(ctx, w * 0.75, h * 0.25, h * 0.04);
      // Hedge and a white fence behind the pool.
      ctx.fillStyle = "#2f7d3a";
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * 0.62 - Math.abs(Math.sin(x * 0.02)) * h * 0.05);
      ctx.lineTo(w, h);
      ctx.fill();
      ctx.fillStyle = "#f6f3ea";
      for (let x = 0; x < w; x += w / 60) ctx.fillRect(x, h * 0.74, w / 90, h * 0.26);
      ctx.fillRect(0, h * 0.8, w, h * 0.025);
      palmTree(ctx, w * 0.15, h * 0.8, h * 0.6, w * 0.03);
      palmTree(ctx, w * 0.82, h * 0.8, h * 0.66, -w * 0.035);
    },
  },
  {
    id: "house",
    name: "House",
    haze: "#4a3a30",
    ambient: 0.3,
    sun: "#ffe2b8",
    floor: (ctx, s) => {
      ctx.fillStyle = "#a9743f";
      ctx.fillRect(0, 0, s, s);
      const r = rng(17);
      const pw = s / 45;
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = `rgba(${90 + r() * 60},${50 + r() * 40},${20 + r() * 20},${0.18 + r() * 0.2})`;
        ctx.fillRect(i * pw, 0, pw - 2, s);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = "rgba(60,35,15,0.5)";
          ctx.fillRect(i * pw, r() * s, pw - 2, 2);
        }
      }
      // A patterned rug under the table.
      const rs = s * 0.4;
      const rx = (s - rs) / 2;
      ctx.fillStyle = "#7d1f2b";
      ctx.fillRect(rx, rx, rs, rs);
      ctx.strokeStyle = "#e9c46a";
      ctx.lineWidth = s * 0.008;
      ctx.strokeRect(rx + s * 0.015, rx + s * 0.015, rs - s * 0.03, rs - s * 0.03);
      ctx.strokeStyle = "#f4e3b5";
      ctx.lineWidth = s * 0.003;
      ctx.strokeRect(rx + s * 0.03, rx + s * 0.03, rs - s * 0.06, rs - s * 0.06);
      for (let i = 0; i < 12; i++)
        for (const [x, y] of [
          [rx + s * 0.045 + (i * (rs - s * 0.09)) / 11, rx + s * 0.045],
          [rx + s * 0.045 + (i * (rs - s * 0.09)) / 11, rx + rs - s * 0.045],
          [rx + s * 0.045, rx + s * 0.045 + (i * (rs - s * 0.09)) / 11],
          [rx + rs - s * 0.045, rx + s * 0.045 + (i * (rs - s * 0.09)) / 11],
        ]) {
          ctx.fillStyle = i % 2 ? "#e9c46a" : "#264653";
          ctx.beginPath();
          ctx.moveTo(x, y - s * 0.008);
          ctx.lineTo(x + s * 0.008, y);
          ctx.lineTo(x, y + s * 0.008);
          ctx.lineTo(x - s * 0.008, y);
          ctx.fill();
        }
      groundShade(ctx, s, 0.35);
    },
    backdrop: (ctx, w, h) => {
      ctx.fillStyle = vgrad(ctx, 0, h, [
        [0, "#e7d3b3"],
        [1, "#d8bf98"],
      ]);
      ctx.fillRect(0, 0, w, h);
      // A window with a view, framed pictures and a sofa.
      const wx = w * 0.4;
      const wy = h * 0.14;
      const ww = w * 0.2;
      const wh = h * 0.42;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
      ctx.fillStyle = vgrad(ctx, wy, wy + wh, [
        [0, "#6db9ee"],
        [0.7, "#d9f1fb"],
        [0.71, "#5aa24c"],
        [1, "#468a39"],
      ]);
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(wx + ww / 2 - 4, wy, 8, wh);
      ctx.fillRect(wx, wy + wh / 2 - 4, ww, 8);
      for (const [x, c] of [
        [0.14, "#c4322b"],
        [0.25, "#264653"],
        [0.72, "#e9c46a"],
        [0.84, "#2a9d8f"],
      ] as [number, string][]) {
        ctx.fillStyle = "#5b3d24";
        ctx.fillRect(w * x - 6, h * 0.2 - 6, w * 0.07 + 12, h * 0.22 + 12);
        ctx.fillStyle = c;
        ctx.fillRect(w * x, h * 0.2, w * 0.07, h * 0.22);
      }
      ctx.fillStyle = "#3d5a80";
      ctx.fillRect(w * 0.08, h * 0.72, w * 0.26, h * 0.28);
      ctx.fillStyle = "#4f71a0";
      ctx.fillRect(w * 0.08, h * 0.64, w * 0.26, h * 0.12);
      ctx.fillStyle = "#6b4a2b";
      ctx.fillRect(0, h * 0.94, w, h * 0.06);
    },
  },
];

export const DEFAULT_SCENE_ID = "room";

export function getScene(id: string | null | undefined): Scene {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}
