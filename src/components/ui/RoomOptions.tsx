"use client";

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

/** House rules: turn timer, bonuses and CPU level. The host edits; everyone else just sees them. */
export function RoomOptions({ state, sessionId, onError }: { state: GameState; sessionId: string; onError?: (msg: string) => void }) {
  const setOptions = useMutation(api.games.setRoomOptions);
  const { room, me } = state;
  const editable = !!me?.isHost && room.status !== "playing";
  const save = (patch: { turnSeconds?: 0 | 20 | 30; bonuses?: boolean; cpuLevel?: "easy" | "normal" | "hard" }) =>
    setOptions({ roomId: room.id, sessionId, ...patch }).catch((e) => onError?.(errorMessage(e)));
  return (
    <div className="space-y-3">
      <Segmented
        label="Turn timer"
        hint="Time runs out: the game plays for you"
        value={room.turnSeconds as 0 | 20 | 30}
        editable={editable}
        options={[
          { value: 0, text: "Off" },
          { value: 20, text: "20s" },
          { value: 30, text: "30s" },
        ]}
        onPick={(turnSeconds) => save({ turnSeconds })}
      />
      <Segmented
        label="Bonuses"
        hint={room.matchType === "2v2" ? "+25 capicúa, +25 when all three pass" : "+25 for a capicúa"}
        value={room.bonuses ? "on" : "off"}
        editable={editable}
        options={[
          { value: "off", text: "Off" },
          { value: "on", text: "On" },
        ]}
        onPick={(v) => save({ bonuses: v === "on" })}
      />
      {room.matchType === "cpu" && (
        <Segmented
          label="CPU level"
          value={room.cpuLevel}
          editable={editable}
          options={[
            { value: "easy", text: "Easy" },
            { value: "normal", text: "Normal" },
            { value: "hard", text: "Hard" },
          ]}
          onPick={(cpuLevel) => save({ cpuLevel })}
        />
      )}
    </div>
  );
}
