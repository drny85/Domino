"use client";

import { useEffect } from "react";
import { useLangStore, useT, type Lang } from "@/lib/i18n";

/** Loads the saved language once; without one, follows the phone's language. */
export function LangInit() {
  useEffect(() => {
    void Promise.resolve(useLangStore.persist.rehydrate()).then(() => {
      const s = useLangStore.getState();
      if (!s.chosen && navigator.language?.toLowerCase().startsWith("es")) useLangStore.setState({ lang: "es" });
    });
    return useLangStore.subscribe((s) => {
      document.documentElement.lang = s.lang;
    });
  }, []);
  return null;
}

/** EN | ES switch. */
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLangStore();
  const t = useT();
  return (
    <div className={`flex rounded-full bg-black/40 p-0.5 text-xs font-semibold ${className}`} role="radiogroup" aria-label={t("Language")}>
      {(["en", "es"] as Lang[]).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={`rounded-full px-2.5 py-1 uppercase transition ${lang === l ? "bg-brass text-stone-900" : "text-stone-300 active:bg-white/10"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
