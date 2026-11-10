"use client";

import { useEffect, useState } from "react";

export type GameViewport = {
  /** The phone is upright, so the game screen is turned a quarter turn to play in landscape. */
  rotate: boolean;
  /** Size of the game screen as laid out (already swapped when rotated). */
  width: number;
  height: number;
  /** Short landscape screen (a phone on its side, a small tablet): the HUD floats over the table. */
  compact: boolean;
};

const PHONE_MAX_SHORT_SIDE = 520;
/** Landscape screens up to this height are too short to give the table its own band. */
const FLOATING_HUD_MAX_HEIGHT = 700;

/**
 * The game is played in landscape on phones. Browsers cannot be relied on to
 * rotate the page (iOS never allows it), so when a phone is held upright the
 * game screen itself is rotated with CSS and the player turns the phone.
 */
export function useGameViewport(): GameViewport {
  const [vp, setVp] = useState<GameViewport>({ rotate: false, width: 0, height: 0, compact: false });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const phone = Math.min(w, h) <= PHONE_MAX_SHORT_SIDE;
      const rotate = phone && h > w;
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
  }, []);

  return vp;
}

type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };

/**
 * Where the browser supports it (Android), go fullscreen and lock the screen
 * to landscape so the phone rotates the page itself. Must be called from a
 * tap. Does nothing elsewhere.
 */
export async function tryLockLandscape() {
  try {
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!orientation?.lock || !document.documentElement.requestFullscreen) return;
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    await orientation.lock("landscape");
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
      const orientation = screen.orientation as LockableOrientation | undefined;
      await orientation?.lock?.("landscape").catch(() => {});
    }
  } catch {
    // Not allowed here.
  }
}
