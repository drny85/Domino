import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const useSettingsStore = create<{ muted: boolean; toggleMuted: () => void }>()(
  persist(
    (set) => ({
      muted: false,
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: "domino.settings", storage: createJSONStorage(() => localStorage) },
  ),
);
