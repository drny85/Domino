"use client";

import { useT } from "@/lib/i18n";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { errorMessage } from "@/store/useGameStore";

/** Points-to-win selector. Editable by the host; read-only for everyone else. */
export function TargetScoreToggle({
  roomId,
  sessionId,
  value,
  editable,
  onError,
}: {
  roomId: Id<"rooms">;
  sessionId: string;
  value: number;
  editable: boolean;
  onError?: (msg: string) => void;
}) {
  const setTarget = useMutation(api.games.setTargetScore);
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-stone-300">{t("Points to win")}</span>
      <div className="ml-auto flex rounded-xl border border-white/10 bg-black/20 p-1" role="radiogroup" aria-label={t("Points to win")}>
        {([100, 200] as const).map((pts) => (
          <button
            key={pts}
            role="radio"
            aria-checked={value === pts}
            disabled={!editable}
            onClick={() =>
              value !== pts &&
              setTarget({ roomId, sessionId, targetScore: pts }).catch((e) => onError?.(errorMessage(e)))
            }
            className={`h-9 w-16 rounded-lg text-sm font-semibold transition disabled:cursor-default ${
              value === pts ? "bg-white/15 text-white" : "text-stone-400 disabled:opacity-40"
            }`}
          >
            {pts}
          </button>
        ))}
      </div>
    </div>
  );
}
