"use client";

import { LangToggle } from "./LangToggle";
import { useT } from "@/lib/i18n";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { GameState } from "@/lib/types";
import { errorMessage } from "@/store/useGameStore";
import { QrCode } from "./QrCode";
import { RoomOptions } from "./RoomOptions";
import { TargetScoreToggle } from "./TargetScoreToggle";
import { ThemeButton } from "./ThemePicker";

type SeatPerson = { name: string; avatar: string | null; isMe: boolean; isHost: boolean; isConnected: boolean; isBot: boolean };

export function WaitingRoom({ state, sessionId }: { state: GameState; sessionId: string }) {
  const router = useRouter();
  const t = useT();
  const startGame = useMutation(api.games.startGame);
  const leaveRoom = useMutation(api.games.leaveRoom);
  const switchSeat = useMutation(api.games.switchSeat);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const { room, me, opponents } = state;
  const seats: (SeatPerson | null)[] = Array.from({ length: room.seats }, () => null);
  if (me) seats[me.seatIndex] = { name: me.name, avatar: me.avatar, isMe: true, isHost: me.isHost, isConnected: true, isBot: false };
  for (const o of opponents) {
    if (o.seatIndex < seats.length) {
      seats[o.seatIndex] = { name: o.name, avatar: o.avatar, isMe: false, isHost: room.hostSeat === o.seatIndex, isConnected: o.isConnected, isBot: o.isBot };
    }
  }
  const filled = seats.filter(Boolean).length;
  const full = filled === room.seats;

  async function share() {
    const url = `${window.location.origin}/room/${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("Join my dominoes game"), text: t("Room code {code}", { code: room.code }), url });
        return;
      }
    } catch {
      /* cancelled; fall back to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError(t("Couldn't copy. The code is {code}", { code: room.code }));
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const SeatCard = ({ seat, index }: { seat: SeatPerson | null; index: number }) =>
    seat ? (
      <div
        className={`flex h-14 items-center gap-3 rounded-xl border px-3 ${
          seat.isMe ? "border-brass/70 bg-brass/10" : "border-white/10 bg-black/20"
        }`}
      >
        <span className={`size-2.5 shrink-0 rounded-full ${seat.isConnected ? "bg-emerald-400" : "bg-stone-500"}`} />
        <span className="text-xl" aria-hidden>
          {seat.avatar ?? "🙂"}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {seat.name}
          {seat.isMe && <span className="text-stone-400"> {t("(you)")}</span>}
        </span>
        {seat.isHost && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{t("Host")}</span>}
        {seat.isBot && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{t("Bot")}</span>}
      </div>
    ) : (
      <button
        disabled={busy || room.matchType !== "2v2"}
        onClick={() => run(() => switchSeat({ roomId: room.id, sessionId, seatIndex: index }))}
        className="flex h-14 w-full items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-stone-400 enabled:active:bg-white/5"
      >
        {room.matchType === "2v2" ? t("Empty seat · tap to sit here") : t("Waiting for a player…")}
      </button>
    );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-safe pt-safe">
      <div className="-mb-4 flex items-center justify-end gap-2 pt-2">
        <LangToggle />
        <ThemeButton />
      </div>
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{t("Room code")}</p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em] text-brass-light">{room.code}</p>
        <p className="mt-2 text-sm text-stone-300">
          {t(room.matchType === "2v2" ? "2 vs 2 teams" : room.matchType === "cpu" ? "vs CPU" : "1 vs 1")} · {room.mode === "draw" ? t("Draw game") : t("Block game")}
        </p>
        <button onClick={share} className="mt-4 h-11 rounded-full bg-white/10 px-6 text-sm font-medium active:bg-white/20">
          {copied ? t("Link copied") : t("Share invite link")}
        </button>
        {room.matchType !== "cpu" && (
          <button
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className="ml-2 mt-4 h-11 rounded-full bg-white/10 px-5 text-sm font-medium active:bg-white/20"
          >
            {showQr ? t("Hide QR") : t("Show QR code")}
          </button>
        )}
        {showQr && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <QrCode value={`${window.location.origin}/room/${room.code}`} className="size-44 rounded-xl" />
            <p className="text-xs text-stone-400">{t("Scan with a phone camera to join")}</p>
            {/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) && (
              <p className="max-w-64 text-xs text-amber-300" role="note">
                {t("This link only works on this computer. Open the game from its network address to invite phones.")}
              </p>
            )}
          </div>
        )}
      </header>

      {room.matchType === "2v2" ? (
        <div className="space-y-4">
          {[0, 1].map((team) => (
            <section key={team} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                {t("Team {x}", { x: team === 0 ? "A" : "B" })}
              </h2>
              {[team, team + 2].map((i) => (
                <SeatCard key={i} seat={seats[i]} index={i} />
              ))}
            </section>
          ))}
          <p className="text-xs text-stone-400">{t("Partners sit across from each other and share a score.")}</p>
        </div>
      ) : (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            {t("Players {n}/{seats}", { n: filled, seats: room.seats })}
          </h2>
          {seats.map((s, i) => (
            <SeatCard key={i} seat={s} index={i} />
          ))}
        </section>
      )}

      <TargetScoreToggle
        roomId={room.id}
        sessionId={sessionId}
        value={room.targetScore}
        editable={!!me?.isHost}
        onError={setError}
      />
      <RoomOptions state={state} sessionId={sessionId} onError={setError} />

      {error && (
        <p role="alert" className="rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <div className="mt-auto space-y-2 pb-2">
        {me?.isHost ? (
          <button
            disabled={!full || busy}
            onClick={() => run(() => startGame({ roomId: room.id, sessionId }))}
            className="h-14 w-full rounded-xl bg-brass text-lg font-semibold text-stone-900 transition active:scale-[0.98] disabled:opacity-40"
          >
            {full ? t("Start game") : t("Waiting for {n} more…", { n: room.seats - filled })}
          </button>
        ) : (
          <p className="text-center text-sm text-stone-300">{t("Waiting for the host to start…")}</p>
        )}
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await leaveRoom({ roomId: room.id, sessionId });
              router.push("/");
            })
          }
          className="h-12 w-full rounded-xl text-sm text-stone-400 active:bg-white/5"
        >
          {t("Leave room")}
        </button>
      </div>
    </main>
  );
}
