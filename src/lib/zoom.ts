/** Table zoom, saved per device. 1 is the fitted view; smaller is closer. */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.6;
const KEY = "domino.zoom";

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function loadZoom(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? clampZoom(v) : 1;
  } catch {
    return 1;
  }
}

export function saveZoom(z: number): number {
  const v = clampZoom(Math.round(z * 100) / 100);
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    // Private mode: the zoom just isn't remembered.
  }
  return v;
}
