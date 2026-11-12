import { describe, expect, it } from "vitest";
import { botLine, TALK_CHANCE } from "../src/lib/botTalk";
import { clampZoom, ZOOM_MAX, ZOOM_MIN } from "../src/lib/zoom";

describe("CPU table talk", () => {
  it("easy is polite, hard is cocky, normal mixes both", () => {
    const seq = (values: number[]) => {
      let i = 0;
      return () => values[i++ % values.length];
    };
    expect(botLine("won", "easy", "en", seq([0]))).toBe("Domino! Good game.");
    expect(botLine("won", "hard", "en", seq([0]))).toBe("Domino! Go home!");
    expect(botLine("won", "normal", "es", seq([0.1, 0]))).toBe("¡Dominó! Buen juego.");
    expect(botLine("won", "normal", "es", seq([0.9, 0]))).toBe("¡Dominó! ¡Pa' la casa!");
  });
  it("always speaks at the end of a round, sometimes during it", () => {
    expect(TALK_CHANCE.won).toBe(1);
    expect(TALK_CHANCE.lost).toBe(1);
    expect(TALK_CHANCE.played).toBeLessThan(1);
  });
});

describe("table zoom", () => {
  it("stays between the iOS limits", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(1.3)).toBe(1.3);
  });
});
