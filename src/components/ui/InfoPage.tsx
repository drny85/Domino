"use client";

import Link from "next/link";
import { LangToggle } from "@/components/ui/LangToggle";
import { useLangStore, useT, type Lang } from "@/lib/i18n";

export type InfoSection = { heading?: string; body: React.ReactNode };
export type InfoCopy = { title: string; intro?: React.ReactNode; sections: InfoSection[]; footnote?: React.ReactNode };

/** A plain readable page (privacy, support) with the EN | ES switch. */
export function InfoPage({ copy }: { copy: Record<Lang, InfoCopy> }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const c = copy[lang];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pb-safe pt-safe">
      <div className="flex items-center justify-between gap-2 pt-2">
        <Link href="/" className="rounded-full px-1 py-1 text-sm font-semibold text-brass-light active:opacity-70">
          ← {t("Back to the game")}
        </Link>
        <LangToggle />
      </div>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Capicúa: Dominoes Online</p>
        <h1 className="text-3xl font-bold tracking-tight">{c.title}</h1>
        {c.intro && <p className="text-base leading-relaxed text-stone-200">{c.intro}</p>}
      </header>
      {c.sections.map((s, i) => (
        <section key={i} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
          {s.heading && <h2 className="text-lg font-semibold text-ivory">{s.heading}</h2>}
          <div className="space-y-2 text-[15px] leading-relaxed text-stone-300">{s.body}</div>
        </section>
      ))}
      {c.footnote && <p className="pb-6 text-xs text-stone-500">{c.footnote}</p>}
    </main>
  );
}

/** A mailto link styled for the info pages. */
export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="font-semibold text-brass-light underline underline-offset-2">
      {email}
    </a>
  );
}
