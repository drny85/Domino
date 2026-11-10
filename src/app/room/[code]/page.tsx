"use client";

import { useT } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { GameView } from "@/components/ui/GameView";
import { WaitingRoom } from "@/components/ui/WaitingRoom";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/store/useGameStore";
import { useProfileStore } from "@/store/useProfileStore";

const HEARTBEAT_MS = 10_000;

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {children}
    </main>
  );
}

export default function RoomPage() {
  const t = useT();
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();
  const { session, setName } = useSession();

  const roomInfo = useQuery(api.games.getRoomByCode, { code });
  const state = useQuery(
    api.games.getGameState,
    roomInfo && session ? { roomId: roomInfo.roomId, sessionId: session.sessionId } : "skip",
  );
  const heartbeat = useMutation(api.games.heartbeat);
  const joinRoom = useMutation(api.games.joinRoom);
  const setAvatar = useMutation(api.games.setAvatar);
  const avatar = useProfileStore((s) => s.avatar);

  const [name, setLocalName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (session) setLocalName(session.name);
  }, [session]);

  const roomId = roomInfo?.roomId;
  const sessionId = session?.sessionId;
  const seated = !!state?.me;
  useEffect(() => {
    if (!roomId || !sessionId || !seated) return;
    const ping = () => void heartbeat({ roomId, sessionId }).catch(() => {});
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    const onVisible = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, sessionId, seated, heartbeat]);

  // Keep the seat's avatar in step with the one picked on this device.
  const seatAvatar = state?.me?.avatar;
  useEffect(() => {
    if (roomId && sessionId && seated && avatar && seatAvatar !== avatar) void setAvatar({ roomId, sessionId, avatar }).catch(() => {});
  }, [roomId, sessionId, seated, avatar, seatAvatar, setAvatar]);

  if (roomInfo === undefined || !session || (roomInfo && state === undefined)) {
    return (
      <Centered>
        <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-brass" aria-label={t("Loading")} />
      </Centered>
    );
  }

  if (roomInfo === null || state === null) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">{t("Room {code} not found", { code })}</h1>
        <Link href="/" className="rounded-xl bg-white/10 px-5 py-3 font-medium">
          {t("Back to lobby")}
        </Link>
      </Centered>
    );
  }

  if (!state!.me && state!.spectator) return <GameView state={state!} sessionId={session.sessionId} />;

  if (!state!.me) {
    const open = roomInfo.status === "waiting" && roomInfo.playerCount < roomInfo.seats && roomInfo.matchType !== "cpu";
    return (
      <Centered>
        <h1 className="text-2xl font-bold">{t("Join room {code}", { code })}</h1>
        <p className="text-sm text-stone-300">
          {t(roomInfo.matchType === "2v2" ? "2 vs 2 teams" : roomInfo.matchType === "cpu" ? "vs CPU" : "1 vs 1")} ·{" "}
          {t("{n}/{seats} seated", { n: roomInfo.playerCount, seats: roomInfo.seats })}
        </p>
        {open ? (
          <form
            className="w-full space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setJoining(true);
              setJoinError(null);
              try {
                setName(name.trim());
                await joinRoom({ code, sessionId: session.sessionId, playerName: name.trim(), avatar });
              } catch (err) {
                setJoinError(errorMessage(err));
              } finally {
                setJoining(false);
              }
            }}
          >
            <input
              value={name}
              onChange={(e) => setLocalName(e.target.value)}
              maxLength={24}
              placeholder={t("Your name")}
              aria-label={t("Your name")}
              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-base outline-none focus:border-brass"
            />
            <button
              disabled={!name.trim() || joining}
              className="h-14 w-full rounded-xl bg-brass text-lg font-semibold text-stone-900 disabled:opacity-40"
            >
              {joining ? t("Joining…") : t("Take a seat")}
            </button>
            {joinError && <p className="text-sm text-red-300">{joinError}</p>}
          </form>
        ) : (
          <p className="text-stone-300">
            {roomInfo.status === "waiting" ? t("This room is full.") : t("This game has already started.")}
          </p>
        )}
        <Link href="/" className="text-sm text-stone-400 underline underline-offset-4">
          {t("Back to lobby")}
        </Link>
      </Centered>
    );
  }

  if (state!.room.status === "waiting") {
    return <WaitingRoom state={state!} sessionId={session.sessionId} />;
  }
  return <GameView state={state!} sessionId={session.sessionId} />;
}
