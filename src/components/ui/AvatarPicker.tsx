"use client";

import { AVATARS } from "../../../convex/lib/rules";

/** A scrolling row of seat avatars. */
export function AvatarPicker({ value, onChange }: { value: string; onChange: (avatar: string) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1" role="radiogroup" aria-label="Your avatar">
      {AVATARS.map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={value === a}
          aria-label={`Avatar ${a}`}
          onClick={() => onChange(a)}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full border text-2xl transition ${
            value === a ? "border-brass bg-brass/20" : "border-white/10 bg-black/20 active:bg-black/40"
          }`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
