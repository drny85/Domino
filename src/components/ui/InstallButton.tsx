"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Offers to add the game to the home screen where the browser allows it. */
export function InstallButton() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setIosHint(ios);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!event && !iosHint) return null;
  return (
    <div className="mb-3">
      <button
        onClick={async () => {
          if (event) {
            await event.prompt();
            await event.userChoice.catch(() => null);
            setEvent(null);
          } else setOpen((v) => !v);
        }}
        className="h-11 rounded-full border border-white/15 bg-white/10 px-5 text-sm font-medium text-stone-200 active:bg-white/20"
      >
        Install the app
      </button>
      {open && !event && (
        <p className="mx-auto mt-2 max-w-xs text-stone-400">
          In Safari, tap the Share button, then “Add to Home Screen”. The game then opens full screen like an app.
        </p>
      )}
    </div>
  );
}
