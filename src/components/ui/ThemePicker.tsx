"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SCENES } from "@/lib/scenes";
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
    // Backgrounds: the backdrop above a strip of the ground.
    const ctx = canvas.getContext("2d")!;
    const part = document.createElement("canvas");
    for (const sc of SCENES) {
      canvas.width = 240;
      canvas.height = 150;
      part.width = 480;
      part.height = 120;
      sc.backdrop(part.getContext("2d")!, 480, 120);
      ctx.drawImage(part, 120, 0, 240, 120, 0, 0, 240, 100);
      part.width = part.height = 256;
      sc.floor(part.getContext("2d")!, 256);
      ctx.drawImage(part, 0, 150, 256, 106, 0, 100, 240, 50);
      out[`scene:${sc.id}`] = canvas.toDataURL("image/jpeg", 0.8);
    }
    setPreviews(out);
  }, [open, previews]);
  return previews;
}

export function ThemeButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const themeId = useThemeStore((s) => s.themeId);
  const t = useT();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium active:bg-black/60 ${className}`}
        aria-label={t("Change table and background")}
      >
        <span className="size-3 rounded-full ring-1 ring-white/40" style={{ background: getTheme(themeId).rim }} />
        <span className="hidden min-[400px]:inline">{t("Table")}</span>
      </button>
      {/* Inside the game screen when there is one, so the sheet turns with it on phones. */}
      {open && createPortal(<ThemeSheet onClose={() => setOpen(false)} />, document.getElementById("game-root") ?? document.body)}
    </>
  );
}

function ThemeSheet({ onClose }: { onClose: () => void }) {
  const { themeId, setTheme, sceneId, setScene } = useThemeStore();
  const previews = usePreviews(true);
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={t("Table and background")}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85%] w-full overflow-y-auto rounded-t-3xl bg-stone-900 p-4 pb-safe shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("Table and background")}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-stone-300 active:bg-white/10">
            {t("Done")}
          </button>
        </div>
        <p className="mb-4 text-xs text-stone-400">{t("Only you see your table and background.")}</p>
        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">{t("Background")}</h3>
          <div className="grid grid-cols-3 gap-3">
            {SCENES.map((sc) => {
              const active = sc.id === sceneId;
              return (
                <button key={sc.id} onClick={() => setScene(sc.id)} aria-pressed={active} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`block aspect-[8/5] w-full overflow-hidden rounded-xl ring-offset-2 ring-offset-stone-900 ${
                      active ? "ring-2 ring-brass-light" : "ring-1 ring-white/15"
                    }`}
                    style={{ background: sc.haze }}
                  >
                    {previews[`scene:${sc.id}`] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[`scene:${sc.id}`]} alt="" className="size-full object-cover" />
                    )}
                  </span>
                  <span className={`text-center text-[11px] leading-tight ${active ? "text-white" : "text-stone-400"}`}>{t(sc.name)}</span>
                </button>
              );
            })}
          </div>
        </section>
        {GROUPS.map((g) => (
          <section key={g} className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              {t(g === "Baseball" ? "Baseball teams" : g)}
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {THEMES.filter((x) => x.group === g).map((th) => {
                const active = th.id === themeId;
                return (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id)}
                    aria-pressed={active}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={`block aspect-square w-full overflow-hidden rounded-full ring-offset-2 ring-offset-stone-900 ${
                        active ? "ring-2 ring-brass-light" : "ring-1 ring-white/15"
                      }`}
                      style={{ background: th.rim, boxShadow: `inset 0 0 0 4px ${th.rim}` }}
                    >
                      {previews[th.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previews[th.id]} alt="" className="size-full rounded-full p-[4px]" />
                      )}
                    </span>
                    <span className={`text-center text-[11px] leading-tight ${active ? "text-white" : "text-stone-400"}`}>
                      {t(th.name)}
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
