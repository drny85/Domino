import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Stats = {
  matchesWon: number;
  matchesLost: number;
  roundsWon: number;
  roundsLost: number;
  capicuas: number;
  streak: number;
  bestStreak: number;
};

const EMPTY: Stats = { matchesWon: 0, matchesLost: 0, roundsWon: 0, roundsLost: 0, capicuas: 0, streak: 0, bestStreak: 0 };

type RoundResult = { key: string; won: boolean; tie: boolean; capicua: boolean; matchOver: boolean; wonMatch: boolean };

/** This device's player: the avatar shown at their seat and their record. */
export const useProfileStore = create<{
  avatar: string;
  stats: Stats;
  /** Rounds already counted, so a reload never counts one twice. */
  recorded: string[];
  setAvatar: (avatar: string) => void;
  recordRound: (r: RoundResult) => void;
  resetStats: () => void;
}>()(
  persist(
    (set) => ({
      avatar: "🙂",
      stats: EMPTY,
      recorded: [],
      setAvatar: (avatar) => set({ avatar }),
      resetStats: () => set({ stats: EMPTY, recorded: [] }),
      recordRound: (r) =>
        set((s) => {
          if (s.recorded.includes(r.key)) return s;
          const st = { ...s.stats };
          if (!r.tie) {
            if (r.won) st.roundsWon++;
            else st.roundsLost++;
          }
          if (r.won && r.capicua) st.capicuas++;
          if (r.matchOver) {
            if (r.wonMatch) {
              st.matchesWon++;
              st.streak++;
              st.bestStreak = Math.max(st.bestStreak, st.streak);
            } else {
              st.matchesLost++;
              st.streak = 0;
            }
          }
          return { stats: st, recorded: [...s.recorded, r.key].slice(-60) };
        }),
    }),
    { name: "domino.profile", storage: createJSONStorage(() => localStorage) },
  ),
);
