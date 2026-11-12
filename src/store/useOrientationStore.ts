import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** How the game table sits on a phone, like the iOS app's Rotation setting. */
export type TableOrientation = "auto" | "portrait" | "landscape";

export const ORIENTATION_LABELS: Record<TableOrientation, string> = {
  auto: "Auto-rotate",
  portrait: "Upright",
  landscape: "Sideways",
};

export const useOrientationStore = create<{ orientation: TableOrientation; setOrientation: (o: TableOrientation) => void }>()(
  persist(
    (set) => ({
      orientation: "auto",
      setOrientation: (orientation) => set({ orientation }),
    }),
    { name: "domino.tableOrientation", storage: createJSONStorage(() => localStorage) },
  ),
);
