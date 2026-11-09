/**
 * Table themes. Every theme is drawn procedurally onto a canvas (no image
 * downloads). The same draw function feeds the 3D table texture and the
 * small previews in the picker.
 *
 * Baseball themes use team colors only (no logos or trademarks).
 */

export type ThemeGroup = "Classic" | "Baseball" | "Countries";

export type TableTheme = {
  id: string;
  name: string;
  group: ThemeGroup;
  /** Wooden/colored rim around the table. */
  rim: string;
  /** Paints the table top into a size×size square (mapped onto the round table). */
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
  /**
   * How much to darken the artwork so ivory tiles stay readable (0 = none).
   * Bright flags need more.
   */
  shade: number;
};

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, rotation = 0) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.382;
    const a = rotation - Math.PI / 2 + (i * Math.PI) / 5;
    ctx[i === 0 ? "moveTo" : "lineTo"](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function hStripes(ctx: CanvasRenderingContext2D, s: number, colors: string[], weights?: number[]) {
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let y = 0;
  colors.forEach((c, i) => {
    const h = (w[i] / total) * s;
    ctx.fillStyle = c;
    ctx.fillRect(0, y, s, Math.ceil(h) + 1);
    y += h;
  });
}

function vStripes(ctx: CanvasRenderingContext2D, s: number, colors: string[]) {
  const w = s / colors.length;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * w, 0, Math.ceil(w) + 1, s);
  });
}

function hoistTriangle(ctx: CanvasRenderingContext2D, s: number, color: string, depth = 0.5) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * depth, s / 2);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fill();
}

function felt(ctx: CanvasRenderingContext2D, s: number, inner: string, mid: string, outer: string) {
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.5);
  g.addColorStop(0, inner);
  g.addColorStop(0.7, mid);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

/** Mowed outfield grass, a chalk diamond and a team-colored warning track. */
function ballpark(primary: string, secondary: string) {
  return (ctx: CanvasRenderingContext2D, s: number) => {
    const stripes = 14;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? "#2f7d3a" : "#378c42";
      ctx.fillRect((i * s) / stripes, 0, s / stripes + 1, s);
    }
    // Checkerboard mow pattern.
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = "#000";
      if (i % 2) ctx.fillRect(0, (i * s) / stripes, s, s / stripes);
    }
    ctx.globalAlpha = 1;

    const c = s / 2;
    // Infield dirt diamond
    ctx.save();
    ctx.translate(c, c * 1.05);
    ctx.rotate(Math.PI / 4);
    const d = s * 0.27;
    ctx.fillStyle = "#b07a4f";
    ctx.fillRect(-d / 2, -d / 2, d, d);
    ctx.fillStyle = "#37833f";
    ctx.fillRect(-d * 0.36, -d * 0.36, d * 0.72, d * 0.72);
    ctx.strokeStyle = "#f5f1e6";
    ctx.lineWidth = s * 0.004;
    ctx.strokeRect(-d * 0.42, -d * 0.42, d * 0.84, d * 0.84);
    ctx.fillStyle = "#f5f1e6";
    for (const [x, y] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
      ctx.fillRect(x * d - s * 0.008, y * d - s * 0.008, s * 0.016, s * 0.016);
    }
    ctx.restore();
    // Pitcher's mound
    ctx.fillStyle = "#b07a4f";
    ctx.beginPath();
    ctx.arc(c, c * 1.05, s * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // Team-colored outer band with trim.
    ctx.lineWidth = s * 0.06;
    ctx.strokeStyle = primary;
    ctx.beginPath();
    ctx.arc(c, c, s * 0.47, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = s * 0.008;
    ctx.strokeStyle = secondary;
    ctx.beginPath();
    ctx.arc(c, c, s * 0.437, 0, Math.PI * 2);
    ctx.stroke();
  };
}

// ---------------------------------------------------------------------------
// Flags (simplified, stretched to the square table top)
// ---------------------------------------------------------------------------

const flags: Record<string, (ctx: CanvasRenderingContext2D, s: number) => void> = {
  dominican(ctx, s) {
    const blue = "#002D62", red = "#CE1126", bar = s * 0.12;
    const a = (s - bar) / 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = blue;
    ctx.fillRect(0, 0, a, a);
    ctx.fillRect(a + bar, a + bar, a, a);
    ctx.fillStyle = red;
    ctx.fillRect(a + bar, 0, a, a);
    ctx.fillRect(0, a + bar, a, a);
    // Simplified coat of arms: a small shield in the flag colors.
    const w = bar * 0.75, x = s / 2 - w / 2, y = s / 2 - w * 0.6;
    ctx.fillStyle = blue;
    ctx.fillRect(x, y, w / 2, w * 0.6);
    ctx.fillStyle = red;
    ctx.fillRect(x + w / 2, y, w / 2, w * 0.6);
    ctx.fillStyle = red;
    ctx.fillRect(x, y + w * 0.6, w / 2, w * 0.5);
    ctx.fillStyle = blue;
    ctx.fillRect(x + w / 2, y + w * 0.6, w / 2, w * 0.5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(s / 2 - w * 0.06, y, w * 0.12, w * 1.1);
    ctx.fillRect(x, y + w * 0.55 - w * 0.06, w, w * 0.12);
  },
  puertoRico(ctx, s) {
    hStripes(ctx, s, ["#ED0000", "#fff", "#ED0000", "#fff", "#ED0000"]);
    hoistTriangle(ctx, s, "#0050F0", 0.6);
    star(ctx, s * 0.2, s / 2, s * 0.1, "#fff");
  },
  cuba(ctx, s) {
    hStripes(ctx, s, ["#002A8F", "#fff", "#002A8F", "#fff", "#002A8F"]);
    hoistTriangle(ctx, s, "#CF142B", 0.6);
    star(ctx, s * 0.2, s / 2, s * 0.1, "#fff");
  },
  usa(ctx, s) {
    hStripes(ctx, s, Array.from({ length: 13 }, (_, i) => (i % 2 ? "#fff" : "#B22234")));
    const cw = s * 0.42, ch = (s * 7) / 13;
    ctx.fillStyle = "#3C3B6E";
    ctx.fillRect(0, 0, cw, ch);
    for (let row = 0; row < 9; row++) {
      const n = row % 2 ? 5 : 6;
      for (let col = 0; col < n; col++) {
        const x = (cw / 12) * (col * 2 + (row % 2 ? 2 : 1));
        const y = (ch / 10) * (row + 1);
        star(ctx, x, y, s * 0.014, "#fff");
      }
    }
  },
  mexico(ctx, s) {
    vStripes(ctx, s, ["#006847", "#fff", "#CE1126"]);
    // Simplified emblem: a wreath ring.
    ctx.lineWidth = s * 0.018;
    ctx.strokeStyle = "#5a7d2a";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.09, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.fillStyle = "#8a5a2b";
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2 - s * 0.01, s * 0.05, s * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  venezuela(ctx, s) {
    hStripes(ctx, s, ["#FFCC00", "#00247D", "#CF142B"]);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (1.18 + (i * 0.64) / 7);
      star(ctx, s / 2 + Math.cos(a) * s * 0.17, s * 0.62 + Math.sin(a) * s * 0.17, s * 0.025, "#fff");
    }
  },
  colombia(ctx, s) {
    hStripes(ctx, s, ["#FCD116", "#003893", "#CE1126"], [2, 1, 1]);
  },
  panama(ctx, s) {
    const h = s / 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#DA121A";
    ctx.fillRect(h, 0, h, h);
    ctx.fillStyle = "#072357";
    ctx.fillRect(0, h, h, h);
    star(ctx, h / 2, h / 2, s * 0.08, "#072357");
    star(ctx, h * 1.5, h * 1.5, s * 0.08, "#DA121A");
  },
  spain(ctx, s) {
    hStripes(ctx, s, ["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1]);
  },
  japan(ctx, s) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#BC002D";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const THEMES: TableTheme[] = [
  { id: "classic", name: "Classic felt", group: "Classic", rim: "#5a3420", shade: 0, draw: (c, s) => felt(c, s, "#1d6a4a", "#155038", "#0d3526") },
  { id: "navy-felt", name: "Midnight felt", group: "Classic", rim: "#2b2b30", shade: 0, draw: (c, s) => felt(c, s, "#24406e", "#1a2f52", "#0f1c33") },
  { id: "burgundy", name: "Casino red", group: "Classic", rim: "#3b2416", shade: 0, draw: (c, s) => felt(c, s, "#7a1f2b", "#5c1620", "#3a0d14") },
  { id: "wood", name: "Wood table", group: "Classic", rim: "#3d2312", shade: 0, draw: (c, s) => {
    c.fillStyle = "#8a5a35";
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = i % 2 ? "rgba(60,30,10,0.18)" : "rgba(255,220,170,0.06)";
      c.fillRect(0, (i * s) / 40, s, s / 80 + (i % 3) * 2);
    }
  } },

  { id: "bb-ny", name: "New York Navy", group: "Baseball", rim: "#0C2340", shade: 0.1, draw: ballpark("#0C2340", "#C4CED3") },
  { id: "bb-bos", name: "Boston Red", group: "Baseball", rim: "#BD3039", shade: 0.1, draw: ballpark("#BD3039", "#0C2340") },
  { id: "bb-la", name: "Los Angeles Blue", group: "Baseball", rim: "#005A9C", shade: 0.1, draw: ballpark("#005A9C", "#ffffff") },
  { id: "bb-chi", name: "Chicago Blue", group: "Baseball", rim: "#0E3386", shade: 0.1, draw: ballpark("#0E3386", "#CC3433") },
  { id: "bb-sf", name: "San Francisco Orange", group: "Baseball", rim: "#FD5A1E", shade: 0.1, draw: ballpark("#FD5A1E", "#27251F") },
  { id: "bb-licey", name: "Licey Blue", group: "Baseball", rim: "#0033A0", shade: 0.1, draw: ballpark("#0033A0", "#ffffff") },
  { id: "bb-escogido", name: "Escogido Red", group: "Baseball", rim: "#C8102E", shade: 0.1, draw: ballpark("#C8102E", "#ffffff") },
  { id: "bb-aguilas", name: "Águilas Yellow", group: "Baseball", rim: "#FFC72C", shade: 0.1, draw: ballpark("#FFC72C", "#000000") },

  { id: "flag-do", name: "Dominican Republic", group: "Countries", rim: "#002D62", shade: 0.35, draw: flags.dominican },
  { id: "flag-pr", name: "Puerto Rico", group: "Countries", rim: "#0050F0", shade: 0.35, draw: flags.puertoRico },
  { id: "flag-us", name: "United States", group: "Countries", rim: "#3C3B6E", shade: 0.35, draw: flags.usa },
  { id: "flag-mx", name: "Mexico", group: "Countries", rim: "#006847", shade: 0.35, draw: flags.mexico },
  { id: "flag-cu", name: "Cuba", group: "Countries", rim: "#002A8F", shade: 0.35, draw: flags.cuba },
  { id: "flag-ve", name: "Venezuela", group: "Countries", rim: "#00247D", shade: 0.35, draw: flags.venezuela },
  { id: "flag-co", name: "Colombia", group: "Countries", rim: "#003893", shade: 0.35, draw: flags.colombia },
  { id: "flag-pa", name: "Panama", group: "Countries", rim: "#072357", shade: 0.35, draw: flags.panama },
  { id: "flag-es", name: "Spain", group: "Countries", rim: "#AA151B", shade: 0.35, draw: flags.spain },
  { id: "flag-jp", name: "Japan", group: "Countries", rim: "#BC002D", shade: 0.35, draw: flags.japan },
];

export const DEFAULT_THEME_ID = "classic";

export function getTheme(id: string | null | undefined): TableTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Draws a theme with shading, vignette and fine grain, ready for a texture. */
export function paintTheme(theme: TableTheme, canvas: HTMLCanvasElement, size: number, grain = true) {
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  theme.draw(ctx, size);
  if (theme.shade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${theme.shade})`;
    ctx.fillRect(0, 0, size, size);
  }
  const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.52);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size, size);
  if (grain) {
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
}
