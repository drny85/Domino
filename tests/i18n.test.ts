import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ES, translate, translateError } from "../src/lib/i18n";
import { SCENES } from "../src/lib/scenes";
import { THEMES } from "../src/lib/themes";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe("Spanish translation", () => {
  it("covers every text used in the interface", () => {
    const keys = new Set<string>();
    for (const f of files("src")) {
      for (const m of readFileSync(f, "utf8").matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]);
    }
    expect(keys.size).toBeGreaterThan(100);
    expect([...keys].filter((k) => !(k in ES))).toEqual([]);
  });

  it("covers table themes, backgrounds and server messages", () => {
    const names = [...THEMES.map((t) => t.name), ...SCENES.map((s) => s.name)];
    // Place names that read the same in Spanish need no entry.
    const same = ["Puerto Rico", "Cuba", "Venezuela", "Colombia"];
    expect(names.filter((n) => !(n in ES) && !same.includes(n))).toEqual([]);
    const server = readFileSync("convex/games.ts", "utf8");
    const messages = [...server.matchAll(/throw new Error\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(messages.filter((m) => !(m in ES))).toEqual([]);
  });

  it("keeps placeholders intact and fills them", () => {
    for (const [en, es] of Object.entries(ES)) {
      expect((es.match(/\{\w+\}/g) ?? []).sort()).toEqual((en.match(/\{\w+\}/g) ?? []).sort());
    }
    expect(translate("es", "{name} passed", { name: "Ana" })).toBe("Ana pasó");
    expect(translate("en", "{name} passed", { name: "Ana" })).toBe("Ana passed");
    expect(translateError("es", "This match needs 4 players (2 seated)")).toBe("Esta partida necesita 4 jugadores (hay 2 sentados)");
  });
});
