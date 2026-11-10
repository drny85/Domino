import { create } from "zustand";
import { translateError, useLangStore } from "@/lib/i18n";

type Toast = { id: number; message: string };

type GameUiState = {
  selectedTileId: string | null;
  select: (id: string | null) => void;
  toast: Toast | null;
  showToast: (message: string) => void;
  clearToast: () => void;
  pending: boolean;
  setPending: (p: boolean) => void;
};

export const useGameStore = create<GameUiState>((set) => ({
  selectedTileId: null,
  select: (selectedTileId) => set({ selectedTileId }),
  toast: null,
  showToast: (message) => set({ toast: { id: Date.now(), message } }),
  clearToast: () => set({ toast: null }),
  pending: false,
  setPending: (pending) => set({ pending }),
}));

/** Convex errors arrive wrapped ("[CONVEX M(...)] Uncaught Error: msg ..."). */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.match(/Uncaught Error:\s*(.+?)(?:\n|\s+at\s|$)/);
  return translateError(useLangStore.getState().lang, (m?.[1] ?? raw).trim());
}
