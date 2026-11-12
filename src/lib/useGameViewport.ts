"use client";

import { useEffect, useState } from "react";
import { useOrientationStore, type TableOrientation } from "@/store/useOrientationStore";

export type GameViewport = {
  /**
   * Quarter turn applied to the game screen with CSS, in degrees: 90 when a
   * phone held upright shows the table sideways, -90 when a phone held
   * sideways shows it upright, 0 when the screen follows the phone.
   */
  rotate: 0 | 90 | -90;
  /** Size of the game screen as laid out (already swapped when rotated). */
  width: number;
  height: number;
  /** Short landscape screen (a phone on its side, a small tablet): the HUD floats over the table. */
  compact: boolean;
};

const PHONE_MAX_SHORT_SIDE = 520;
/** Landscape screens up to this height are too short to give the table its own band. */
const FLOATING_HUD_MAX_HEIGHT = 700;

/** The quarter turn that keeps a phone's table the way the player locked it. */
export function rotationFor(orientation: TableOrientation, w: number, h: number): 0 | 90 | -90 {
  if (Math.min(w, h) > PHONE_MAX_SHORT_SIDE) return 0;
  if (orientation === "landscape" && h > w) return 90;
  if (orientation === "portrait" && w > h) return -90;
  return 0;
}

/**
 * Like the iOS app, the table follows the phone (Auto-rotate) unless the
 * player locks it Upright or Sideways. Browsers cannot be relied on to rotate
 * the page (iOS never allows it), so a locked table that disagrees with how
 * the phone is held is turned a quarter turn with CSS.
 */
export function useGameViewport(): GameViewport {
  const orientation = useOrientationStore((s) => s.orientation);
  const [vp, setVp] = useState<GameViewport>({ rotate: 0, width: 0, height: 0, compact: false });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const rotate = rotationFor(orientation, w, h);
      const width = rotate ? h : w;
      const height = rotate ? w : h;
      setVp({ rotate, width, height, compact: height <= PHONE_MAX_SHORT_SIDE || (width > height && height <= FLOATING_HUD_MAX_HEIGHT) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [orientation]);

  return vp;
}

type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape" | "portrait") => Promise<void> };

/**
 * Where the browser supports it (Android), go fullscreen and lock the screen
 * the way the player locked the table (or free it on Auto-rotate), so the
 * phone rotates the page itself. Must be called from a tap. Does nothing
 * where the browser doesn't allow it.
 */
export async function tryLockOrientation(table: TableOrientation) {
  try {
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!document.documentElement.requestFullscreen) return;
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    if (table === "auto") orientation?.unlock?.();
    else await orientation?.lock?.(table);
  } catch {
    // Not allowed here: the CSS rotation already covers it.
  }
}

export function releaseLandscape() {
  try {
    screen.orientation?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen();
  } catch {
    // Nothing to release.
  }
}

/** Enters or leaves full screen (hides the browser bars where the browser allows it). */
export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      const table = useOrientationStore.getState().orientation;
      const orientation = screen.orientation as LockableOrientation | undefined;
      if (table !== "auto") await orientation?.lock?.(table).catch(() => {});
    }
  } catch {
    // Not allowed here.
  }
}
