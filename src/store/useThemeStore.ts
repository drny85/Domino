import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_THEME_ID } from "@/lib/themes";

/** Table theme is a personal preference: each player sees their own. */
export const useThemeStore = create<{ themeId: string; setTheme: (id: string) => void }>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      setTheme: (themeId) => set({ themeId }),
    }),
    { name: "domino.tableTheme", storage: createJSONStorage(() => localStorage) },
  ),
);
