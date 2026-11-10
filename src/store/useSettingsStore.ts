import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const useSettingsStore = create<{ muted: boolean; toggleMuted: () => void }>()(
  persist(
    (set) => ({
      // Sound starts off; the player turns it on with the speaker button.
      muted: true,
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: "domino.settings",
      storage: createJSONStorage(() => localStorage),
      // Version 1 made "off" the default: earlier saved settings start muted too.
      version: 1,
      migrate: () => ({ muted: true }),
    },
  ),
);
