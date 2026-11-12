"use client";

import { useT } from "@/lib/i18n";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { GameState } from "@/lib/types";
import { errorMessage } from "@/store/useGameStore";

function Segmented<T extends string | number>({
  label,
  hint,
  options,
  value,
  editable,
  onPick,
}: {
  label: string;
  hint?: string;
  options: { value: T; text: string }[];
  value: T;
  editable: boolean;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 text-sm text-stone-300">
        {label}
        {hint && <span className="block text-[11px] leading-tight text-stone-500">{hint}</span>}
      </span>
      <div className="ml-auto flex shrink-0 rounded-xl border border-white/10 bg-black/20 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={value === o.value}
            disabled={!editable}
            onClick={() => value !== o.value && onPick(o.value)}
            className={`h-9 min-w-12 rounded-lg px-2 text-sm font-semibold transition disabled:cursor-default ${
              value === o.value ? "bg-white/15 text-white" : "text-stone-400 disabled:opacity-40"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** House rules: turn timer, bonuses (and their value) and CPU level. The host edits; everyone else just sees them. */
export function RoomOptions({ state, sessionId, onError }: { state: GameState; sessionId: string; onError?: (msg: string) => void }) {
  const setOptions = useMutation(api.games.setRoomOptions);
  const t = useT();
  const { room, me } = state;
  const editable = (!!me?.isHost || !!state.spectator?.isHost) && room.status !== "playing";
  const save = (patch: { turnSeconds?: 0 | 20 | 30; bonuses?: boolean; bonusPoints?: 25 | 30; cpuLevel?: "easy" | "normal" | "hard" }) =>
    setOptions({ roomId: room.id, sessionId, ...patch }).catch((e) => onError?.(errorMessage(e)));
  return (
    <div className="space-y-3">
      <Segmented
        label={t("Turn timer")}
        hint={t("Time runs out: the game plays for you")}
        value={room.turnSeconds as 0 | 20 | 30}
        editable={editable}
        options={[
          { value: 0, text: t("Off") },
          { value: 20, text: "20s" },
          { value: 30, text: "30s" },
        ]}
        onPick={(turnSeconds) => save({ turnSeconds })}
      />
      <Segmented
        label={t("Bonuses")}
        hint={
          room.seats === 4
            ? t("+{n} capicúa, +{n} when the next player can't answer the first tile, +{n} when all three pass", { n: room.bonusPoints })
            : t("+{n} capicúa, +{n} when the next player can't answer the first tile", { n: room.bonusPoints })
        }
        value={room.bonuses ? "on" : "off"}
        editable={editable}
        options={[
          { value: "off", text: t("Off") },
          { value: "on", text: t("On") },
        ]}
        onPick={(v) => save({ bonuses: v === "on" })}
      />
      {room.bonuses && (
        <Segmented
          label={t("Bonus value")}
          value={room.bonusPoints as 25 | 30}
          editable={editable}
          options={[
            { value: 25, text: "25" },
            { value: 30, text: "30" },
          ]}
          onPick={(bonusPoints) => save({ bonusPoints })}
        />
      )}
      {(room.matchType === "cpu" || room.matchType === "watch") && (
        <Segmented
          label={t("CPU level")}
          value={room.cpuLevel}
          editable={editable}
          options={[
            { value: "easy", text: t("Easy") },
            { value: "normal", text: t("Normal") },
            { value: "hard", text: t("Hard") },
          ]}
          onPick={(cpuLevel) => save({ cpuLevel })}
        />
      )}
    </div>
  );
}
