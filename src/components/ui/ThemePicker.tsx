"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { THEMES, getTheme, paintTheme, type ThemeGroup } from "@/lib/themes";
import { useThemeStore } from "@/store/useThemeStore";

const GROUPS: ThemeGroup[] = ["Classic", "Baseball", "Countries"];

/** Renders every theme once to a small data URL for the swatches. */
function usePreviews(open: boolean) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || Object.keys(previews).length) return;
    const canvas = document.createElement("canvas");
    const out: Record<string, string> = {};
    for (const t of THEMES) {
      paintTheme(t, canvas, 160, false);
      out[t.id] = canvas.toDataURL("image/png");
    }
    setPreviews(out);
  }, [open, previews]);
  return previews;
}

export function ThemeButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const themeId = useThemeStore((s) => s.themeId);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium active:bg-black/60 ${className}`}
        aria-label="Change table theme"
      >
        <span className="size-3 rounded-full ring-1 ring-white/40" style={{ background: getTheme(themeId).rim }} />
        Table
      </button>
      {open && createPortal(<ThemeSheet onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ThemeSheet({ onClose }: { onClose: () => void }) {
  const { themeId, setTheme } = useThemeStore();
  const previews = usePreviews(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Table theme"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-stone-900 p-4 pb-safe shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Table theme</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-stone-300 active:bg-white/10">
            Done
          </button>
        </div>
        <p className="mb-4 text-xs text-stone-400">Only you see your table theme.</p>
        {GROUPS.map((g) => (
          <section key={g} className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              {g === "Baseball" ? "Baseball teams" : g}
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {THEMES.filter((t) => t.group === g).map((t) => {
                const active = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    aria-pressed={active}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={`block aspect-square w-full overflow-hidden rounded-full ring-offset-2 ring-offset-stone-900 ${
                        active ? "ring-2 ring-brass-light" : "ring-1 ring-white/15"
                      }`}
                      style={{ background: t.rim, boxShadow: `inset 0 0 0 4px ${t.rim}` }}
                    >
                      {previews[t.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previews[t.id]} alt="" className="size-full rounded-full p-[4px]" />
                      )}
                    </span>
                    <span className={`text-center text-[11px] leading-tight ${active ? "text-white" : "text-stone-400"}`}>
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
