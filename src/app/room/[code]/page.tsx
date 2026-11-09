"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { GameView } from "@/components/ui/GameView";
import { WaitingRoom } from "@/components/ui/WaitingRoom";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/store/useGameStore";

const HEARTBEAT_MS = 10_000;

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {children}
    </main>
  );
}

export default function RoomPage() {
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

  if (roomInfo === undefined || !session || (roomInfo && state === undefined)) {
    return (
      <Centered>
        <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-brass" aria-label="Loading" />
      </Centered>
    );
  }

  if (roomInfo === null || state === null) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Room {code} not found</h1>
        <Link href="/" className="rounded-xl bg-white/10 px-5 py-3 font-medium">
          Back to lobby
        </Link>
      </Centered>
    );
  }

  if (!state!.me) {
    const open = roomInfo.status === "waiting" && roomInfo.playerCount < roomInfo.seats && roomInfo.matchType !== "cpu";
    return (
      <Centered>
        <h1 className="text-2xl font-bold">Join room {code}</h1>
        <p className="text-sm text-stone-300">
          {roomInfo.matchType === "2v2" ? "2 vs 2 teams" : roomInfo.matchType === "cpu" ? "vs CPU" : "1 vs 1"} ·{" "}
          {roomInfo.playerCount}/{roomInfo.seats} seated
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
                await joinRoom({ code, sessionId: session.sessionId, playerName: name.trim() });
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
              placeholder="Your name"
              aria-label="Your name"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-base outline-none focus:border-brass"
            />
            <button
              disabled={!name.trim() || joining}
              className="h-14 w-full rounded-xl bg-brass text-lg font-semibold text-stone-900 disabled:opacity-40"
            >
              {joining ? "Joining…" : "Take a seat"}
            </button>
            {joinError && <p className="text-sm text-red-300">{joinError}</p>}
          </form>
        ) : (
          <p className="text-stone-300">
            {roomInfo.status === "waiting" ? "This room is full." : "This game has already started."}
          </p>
        )}
        <Link href="/" className="text-sm text-stone-400 underline underline-offset-4">
          Back to lobby
        </Link>
      </Centered>
    );
  }

  if (state!.room.status === "waiting") {
    return <WaitingRoom state={state!} sessionId={session.sessionId} />;
  }
  return <GameView state={state!} sessionId={session.sessionId} />;
}
