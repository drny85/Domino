"use client";

import { LangToggle } from "@/components/ui/LangToggle";
import { useT } from "@/lib/i18n";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { AvatarPicker } from "@/components/ui/AvatarPicker";
import { DominoFace } from "@/components/ui/DominoFace";
import { InstallButton } from "@/components/ui/InstallButton";
import { ThemeButton } from "@/components/ui/ThemePicker";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/store/useGameStore";
import { useProfileStore } from "@/store/useProfileStore";

type MatchType = "1v1" | "2v2" | "cpu";
type Mode = "draw" | "block";

const MATCHES: { id: MatchType; title: string; detail: string }[] = [
  { id: "1v1", title: "1 vs 1", detail: "Invite a friend" },
  { id: "2v2", title: "2 vs 2", detail: "Teams, partners sit across" },
  { id: "cpu", title: "vs CPU", detail: "Play solo right now" },
];

export default function Home() {
  const router = useRouter();
  const t = useT();
  const { session, setName, newTabIdentity } = useSession();
  const createRoom = useMutation(api.games.createRoom);
  const joinRoom = useMutation(api.games.joinRoom);

  const [name, setLocalName] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("1v1");
  const [mode, setMode] = useState<Mode>("draw");
  const [targetScore, setTargetScore] = useState<100 | 200>(200);
  const [cpuLevel, setCpuLevel] = useState<"easy" | "normal" | "hard">("normal");
  const { avatar, setAvatar, stats } = useProfileStore();
  // Saved choices only exist in the browser; wait for it before showing them.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) setLocalName(session.name);
  }, [session]);

  const ready = !!session && name.trim().length > 0;

  async function onCreate() {
    if (!session || !ready) return;
    setBusy("create");
    setError(null);
    try {
      setName(name.trim());
      const res = await createRoom({ sessionId: session.sessionId, playerName: name.trim(), mode, matchType, targetScore, avatar, cpuLevel });
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !ready || code.trim().length !== 6) return;
    setBusy("join");
    setError(null);
    try {
      setName(name.trim());
      const res = await joinRoom({ code: code.trim().toUpperCase(), sessionId: session.sessionId, playerName: name.trim(), avatar });
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-safe pt-safe">
      <div className="flex items-center justify-end gap-2 pt-2">
        <LangToggle />
        <ThemeButton />
      </div>
      <header className="flex flex-col items-center gap-3">
        <div className="flex items-end gap-2" aria-hidden>
          <DominoFace a={6} b={6} className="w-10 -rotate-12" />
          <DominoFace a={3} b={5} className="w-12" />
          <DominoFace a={1} b={4} className="w-10 rotate-12" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("Dominoes")}</h1>
        <p className="text-sm text-stone-300">{t("Double-Six · real-time · no sign-up")}</p>
      </header>

      <section className="space-y-2">
        <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          {t("Your name")}
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setLocalName(e.target.value)}
          maxLength={24}
          autoComplete="nickname"
          placeholder={t("e.g. Robert")}
          className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-base outline-none placeholder:text-stone-500 focus:border-brass"
        />
        {mounted && <AvatarPicker value={avatar} onChange={setAvatar} />}
        {mounted && stats.roundsWon + stats.roundsLost > 0 && (
          <p className="text-xs text-stone-400">
            {t("Your record: {won} matches won, {lost} lost · {rounds} rounds won", { won: stats.matchesWon, lost: stats.matchesLost, rounds: stats.roundsWon })}
            {stats.capicuas > 0 && <> · {t("{n} capicúas", { n: stats.capicuas })}</>}
            {stats.bestStreak > 1 && <> · {t("best streak {n}", { n: stats.bestStreak })}</>}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{t("New game")}</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("Match type")}>
          {MATCHES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={matchType === m.id}
              onClick={() => setMatchType(m.id)}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition ${
                matchType === m.id
                  ? "border-brass bg-brass/15 text-white"
                  : "border-white/10 bg-black/20 text-stone-300 active:bg-black/40"
              }`}
            >
              <span className="text-base font-semibold">{t(m.title)}</span>
              <span className="text-[11px] leading-tight text-stone-400">{t(m.detail)}</span>
            </button>
          ))}
        </div>

        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1" role="radiogroup" aria-label={t("Rules")}>
          {(["draw", "block"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${
                mode === m ? "bg-white/15 text-white" : "text-stone-400"
              }`}
            >
              {m === "draw" ? t("Draw game") : t("Block game")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-300">{t("Points to win")}</span>
          <div className="ml-auto flex rounded-xl border border-white/10 bg-black/20 p-1" role="radiogroup" aria-label={t("Points to win")}>
            {([100, 200] as const).map((pts) => (
              <button
                key={pts}
                role="radio"
                aria-checked={targetScore === pts}
                onClick={() => setTargetScore(pts)}
                className={`h-9 w-16 rounded-lg text-sm font-semibold transition ${
                  targetScore === pts ? "bg-white/15 text-white" : "text-stone-400"
                }`}
              >
                {pts}
              </button>
            ))}
          </div>
        </div>

        {matchType === "cpu" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-300">{t("CPU level")}</span>
            <div className="ml-auto flex rounded-xl border border-white/10 bg-black/20 p-1" role="radiogroup" aria-label={t("CPU level")}>
              {(["easy", "normal", "hard"] as const).map((lv) => (
                <button
                  key={lv}
                  role="radio"
                  aria-checked={cpuLevel === lv}
                  onClick={() => setCpuLevel(lv)}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold capitalize transition ${
                    cpuLevel === lv ? "bg-white/15 text-white" : "text-stone-400"
                  }`}
                >
                  {t(lv === "easy" ? "Easy" : lv === "normal" ? "Normal" : "Hard")}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-stone-400">
          {mode === "draw"
            ? t("Can't play? Draw from the boneyard until you can.")
            : t("Can't play? Pass. No drawing.")}
        </p>

        <button
          onClick={onCreate}
          disabled={!ready || busy !== null}
          className="h-14 w-full rounded-xl bg-brass text-lg font-semibold text-stone-900 shadow-lg shadow-black/30 transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy === "create" ? t("Creating…") : matchType === "cpu" ? t("Play vs CPU") : t("Create room")}
        </button>
      </section>

      <form onSubmit={onJoin} className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{t("Join with a code")}</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))}
            placeholder="ABCDEF"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t("Room code")}
            className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 text-center font-mono text-lg tracking-[0.3em] outline-none placeholder:text-stone-600 focus:border-brass"
          />
          <button
            type="submit"
            disabled={!ready || code.length !== 6 || busy !== null}
            className="h-12 rounded-xl border border-white/15 bg-white/10 px-5 font-semibold transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy === "join" ? "…" : t("Join")}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <footer className="mt-auto pb-2 text-center text-xs text-stone-500">
        <InstallButton />
        {!ready && session && <p className="mb-2">{t("Enter a name to start.")}</p>}
        <button onClick={newTabIdentity} className="underline decoration-dotted underline-offset-4">
          {session?.isTabIdentity ? t("Using a separate identity in this tab") : t("Testing? Use a separate player in this tab")}
        </button>
      </footer>
    </main>
  );
}
