import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_SCENE_ID } from "@/lib/scenes";
import { DEFAULT_THEME_ID } from "@/lib/themes";

/** Table theme and background are personal preferences: each player sees their own. */
export const useThemeStore = create<{
  themeId: string;
  sceneId: string;
  setTheme: (id: string) => void;
  setScene: (id: string) => void;
}>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      sceneId: DEFAULT_SCENE_ID,
      setTheme: (themeId) => set({ themeId }),
      setScene: (sceneId) => set({ sceneId }),
    }),
    { name: "domino.tableTheme", storage: createJSONStorage(() => localStorage) },
  ),
);
