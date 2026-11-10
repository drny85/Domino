"use client";

import { useMutation } from "convex/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Side, Tile } from "../../../convex/lib/rules";
import type { GhostSpec } from "@/components/3d/GameScene";
import type { GameState } from "@/lib/types";
import { errorMessage, useGameStore } from "@/store/useGameStore";
import { DominoFace } from "./DominoFace";
import { TargetScoreToggle } from "./TargetScoreToggle";
import { ThemeButton } from "./ThemePicker";

const GameScene = dynamic(() => import("@/components/3d/GameScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-brass" />
    </div>
  ),
});

type Seat = {
  seatIndex: number;
  name: string;
  isMe: boolean;
  tileCount: number;
  score: number;
  team: number;
  isConnected: boolean;
  isBot: boolean;
  finalPips: number | null;
};

export function GameView({ state, sessionId }: { state: GameState; sessionId: string }) {
  const { room, me, opponents } = state;
  const playTile = useMutation(api.games.playTile);
  const drawOrPass = useMutation(api.games.drawOrPass);
  const startGame = useMutation(api.games.startGame);

  const { selectedTileId, select, toast, showToast, clearToast, pending, setPending } = useGameStore();
  const [zoom, setZoom] = useState(1);

  const seats: Seat[] = useMemo(() => {
    const list: Seat[] = opponents.map((o) => ({ ...o, isMe: false }));
    if (me) {
      list.push({
        seatIndex: me.seatIndex,
        name: me.name,
        isMe: true,
        tileCount: me.hand.length,
        score: me.score,
        team: me.team,
        isConnected: true,
        isBot: false,
        finalPips: me.finalPips,
      });
    }
    return list.sort((a, b) => a.seatIndex - b.seatIndex);
  }, [opponents, me]);

  const bySeat = (seat: number | null | undefined) => seats.find((s) => s.seatIndex === seat);
  const current = bySeat(room.currentTurnSeat);
  const isTeams = room.matchType === "2v2";
  const teamScore = (team: number) => seats.filter((s) => s.team === team).reduce((a, s) => a + s.score, 0);

  // Opponents in turn order, starting with whoever plays after me.
  const mySeat = me?.seatIndex ?? 0;
  const others = seats
    .filter((s) => !s.isMe)
    .sort((a, b) => ((a.seatIndex - mySeat + seats.length) % seats.length) - ((b.seatIndex - mySeat + seats.length) % seats.length));

  const playableMap = useMemo(() => new Map(me?.playable.map((p) => [p.tileId, p.sides as Side[]]) ?? []), [me?.playable]);
  const hand = useMemo(() => [...(me?.hand ?? [])].sort((x, y) => x.a - y.a || x.b - y.b), [me?.hand]);
  const selected = hand.find((t) => t.id === selectedTileId) ?? null;
  const selectedSides = selected ? (playableMap.get(selected.id) ?? []) : [];

  // Drop a stale selection when the turn or hand changes.
  useEffect(() => {
    if (selectedTileId && !playableMap.has(selectedTileId)) select(null);
  }, [playableMap, selectedTileId, select]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 2200);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  async function play(tile: Tile, side: Side) {
    setPending(true);
    try {
      await playTile({ roomId: room.id, sessionId, tileId: tile.id, targetSide: side });
      select(null);
      navigator.vibrate?.(12);
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  function onTileTap(tile: Tile) {
    if (pending || !me) return;
    if (room.status !== "playing") return;
    if (!me.isMyTurn) {
      showToast(`Wait for ${current?.name ?? "your"} turn`);
      return;
    }
    const sides = playableMap.get(tile.id);
    if (!sides) {
      showToast(`${tile.a}-${tile.b} doesn't match ${room.openEnds.left} or ${room.openEnds.right}`);
      return;
    }
    if (sides.length === 1) {
      void play(tile, sides[0]);
      return;
    }
    select(selectedTileId === tile.id ? null : tile.id);
  }

  async function onDrawOrPass() {
    setPending(true);
    try {
      await drawOrPass({ roomId: room.id, sessionId });
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  const ghosts: GhostSpec[] = selected ? selectedSides.map((side) => ({ side, tile: selected })) : [];
  const lastPlayedId = room.lastAction?.kind === "play" ? (room.lastAction.tileId ?? null) : null;

  const activity = (() => {
    const a = room.lastAction;
    if (!a) return null;
    const who = bySeat(a.seatIndex);
    const name = who?.isMe ? "You" : (who?.name ?? "Someone");
    if (a.kind === "draw") return `${name} drew a tile`;
    if (a.kind === "pass") return `${name} passed`;
    if (a.kind === "play" && a.tileId) return `${name} played ${a.tileId}`;
    return null;
  })();

  const turnText =
    room.status !== "playing"
      ? "Round over"
      : me?.isMyTurn
        ? room.board.length === 0
          ? "Your lead: play any tile"
          : me.canDrawOrPass
            ? me.willDraw
              ? "No match: draw a tile"
              : "No match: pass"
            : selected
              ? "Pick an end of the chain"
              : "Your turn"
        : current?.isBot
          ? "CPU is thinking…"
          : `${current?.name ?? "…"}'s turn`;

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-felt-900">
      {/* Top bar */}
      <header className="z-10 flex flex-col gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pt-safe">
        <div className="flex items-center gap-2 whitespace-nowrap text-xs text-stone-300">
          <Link href="/" className="-ml-1 rounded-lg px-2 py-1.5 active:bg-white/10" aria-label="Back to lobby">
            ←
          </Link>
          <span className="font-mono tracking-widest text-brass-light">{room.code}</span>
          <span className="text-stone-500">·</span>
          <span>Round {room.round}</span>
          <span className="text-stone-500">·</span>
          <span>To {room.targetScore}</span>

          <span className="ml-auto flex items-center gap-2">
            {isTeams && (
              <span className="rounded-full bg-black/40 px-2 py-0.5 font-medium">
                A {teamScore(0)} · B {teamScore(1)}
              </span>
            )}
            <ThemeButton className="py-1" />
          </span>
        </div>
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {others.map((o) => (
            <OpponentChip
              key={o.seatIndex}
              seat={o}
              active={room.status === "playing" && room.currentTurnSeat === o.seatIndex}
              partner={isTeams && me ? o.team === me.team : false}
              showTeam={isTeams}
            />
          ))}
          <div className="flex shrink-0 flex-col justify-center rounded-xl border border-white/5 bg-black/25 px-2.5 py-1.5 leading-tight">
            <p className="text-[11px] text-stone-400">{room.mode === "draw" ? "Boneyard" : "Block game"}</p>
            <p className="text-sm font-medium">{room.mode === "draw" ? `${room.boneyardCount} tiles` : "No drawing"}</p>
          </div>
        </div>
      </header>

      {/* 3D table */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <GameScene
            board={room.board}
            openEnds={room.openEnds}
            lastPlayedId={lastPlayedId}
            ghosts={ghosts}
            onGhost={(side) => selected && play(selected, side)}
            zoom={zoom}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1">
          {room.openEnds.left !== null && (
            <div className="rounded-full bg-black/50 px-3 py-1 text-xs text-stone-200 backdrop-blur">
              Ends: <b className="text-white">{room.openEnds.left}</b> · <b className="text-white">{room.openEnds.right}</b>
            </div>
          )}
          {toast && (
            <div
              key={toast.id}
              role="status"
              className="toast-in absolute left-1/2 top-9 w-max max-w-[90vw] rounded-xl bg-stone-900/95 px-4 py-2 text-sm text-white shadow-lg"
            >
              {toast.message}
            </div>
          )}
        </div>

        <div className="absolute bottom-3 right-3 flex flex-col gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.55, z - 0.15))}
            className="size-10 rounded-full bg-black/50 text-lg backdrop-blur active:bg-black/70"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
            className="size-10 rounded-full bg-black/50 text-lg backdrop-blur active:bg-black/70"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {activity && (
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[60%] truncate rounded-full bg-black/40 px-3 py-1 text-xs text-stone-300 backdrop-blur">
            {activity}
          </div>
        )}
      </div>

      {/* My hand */}
      <footer className="z-10 bg-gradient-to-t from-black/80 via-black/60 to-black/20 pb-safe">
        <div className="flex items-center gap-2 px-3 pt-2">
          <span
            className={`size-2.5 rounded-full ${me?.isMyTurn ? "turn-pulse bg-brass-light" : "bg-stone-600"}`}
            aria-hidden
          />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{turnText}</p>
          <span className="text-xs text-stone-400">
            {me?.name} · {me?.score ?? 0} pts
          </span>
        </div>

        {selected && selectedSides.length === 2 && (
          <div className="flex gap-2 px-3 pt-2">
            {(["left", "right"] as const).map((side) => (
              <button
                key={side}
                disabled={pending}
                onClick={() => play(selected, side)}
                className="h-11 flex-1 rounded-xl bg-brass/90 text-sm font-semibold text-stone-900 active:bg-brass"
              >
                {side === "left" ? `◀ Left end (${room.openEnds.left})` : `Right end (${room.openEnds.right}) ▶`}
              </button>
            ))}
          </div>
        )}

        {/* Centered when the hand fits; scrolls from the first tile when it doesn't. */}
        <div className="no-scrollbar overflow-x-auto pb-2 pt-5">
          <div className="mx-auto flex w-max min-w-full items-end justify-center gap-2 px-3" role="list" aria-label="Your tiles">
          {hand.map((t) => {
            const canPlay = playableMap.has(t.id);
            const dim = me?.isMyTurn && !canPlay && room.board.length > 0;
            const isSel = t.id === selectedTileId;
            return (
              <button
                key={t.id}
                role="listitem"
                onClick={() => onTileTap(t)}
                aria-label={`Tile ${t.a}-${t.b}${canPlay ? ", playable" : ""}`}
                className={`shrink-0 rounded-lg transition-transform duration-150 ${isSel ? "-translate-y-3" : canPlay && me?.isMyTurn ? "-translate-y-1" : ""} ${
                  dim ? "opacity-40" : ""
                } ${isSel ? "ring-2 ring-brass-light ring-offset-2 ring-offset-black" : ""}`}
              >
                <DominoFace a={t.a} b={t.b} className="w-[clamp(2.5rem,11.5vw,3.5rem)]" />
              </button>
            );
          })}
          {me?.canDrawOrPass && (
            <button
              disabled={pending}
              onClick={onDrawOrPass}
              className="turn-pulse ml-2 h-16 shrink-0 self-center rounded-xl bg-brass px-5 font-semibold text-stone-900 active:scale-95 disabled:opacity-50"
            >
              {me.willDraw ? `Draw (${room.boneyardCount})` : "Pass"}
            </button>
          )}
          </div>
        </div>
      </footer>

      {room.status === "finished" && (
        <RoundOverSheet
          state={state}
          seats={seats}
          sessionId={sessionId}
          onError={showToast}
          onNext={async () => {
            try {
              await startGame({ roomId: room.id, sessionId });
            } catch (e) {
              showToast(errorMessage(e));
            }
          }}
          teamScore={teamScore}
        />
      )}
    </main>
  );
}

function OpponentChip({ seat, active, partner, showTeam }: { seat: Seat; active: boolean; partner: boolean; showTeam: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 ${
        active ? "turn-pulse border-brass-light bg-brass/15" : "border-white/10 bg-black/40"
      }`}
    >
      <span className={`size-2 rounded-full ${seat.isConnected ? "bg-emerald-400" : "bg-stone-500"}`} />
      <div className="leading-tight">
        <p className="max-w-24 truncate text-sm font-medium">
          {seat.name}
          {showTeam && <span className="ml-1 text-[10px] text-stone-400">{partner ? "partner" : `team ${seat.team === 0 ? "A" : "B"}`}</span>}
        </p>
        <p className="text-[11px] text-stone-400">
          {seat.tileCount} tiles · {seat.score} pts
        </p>
      </div>
      <div className="flex -space-x-2" aria-hidden>
        {Array.from({ length: Math.min(seat.tileCount, 5) }).map((_, i) => (
          <span key={i} className="h-5 w-2.5 rounded-[2px] border border-stone-400/60 bg-stone-200" />
        ))}
      </div>
    </div>
  );
}

function RoundOverSheet({
  state,
  seats,
  sessionId,
  onError,
  onNext,
  teamScore,
}: {
  state: GameState;
  seats: Seat[];
  sessionId: string;
  onError: (msg: string) => void;
  onNext: () => void;
  teamScore: (team: number) => number;
}) {
  const { room, me } = state;
  const winner = seats.find((s) => s.seatIndex === room.winnerSeat);
  const isTeams = room.matchType === "2v2";
  const iWon = !!winner && !!me && (isTeams ? winner.team === me.team : winner.isMe);

  const matchWinnerName = isTeams
    ? `Team ${room.matchWinnerTeam === 0 ? "A" : "B"}`
    : (seats.find((s) => s.seatIndex === room.matchWinnerTeam)?.name ?? "Someone");
  const iWonMatch = room.matchOver && !!me && me.team === room.matchWinnerTeam;

  const headline = room.matchOver
    ? iWonMatch
      ? isTeams
        ? "Your team wins the match!"
        : "You win the match!"
      : `${matchWinnerName} wins the match`
    : room.winReason === "blocked-tie"
      ? "Blocked: it's a tie"
      : iWon
        ? isTeams
          ? "Your team wins!"
          : "You win!"
        : isTeams
          ? `Team ${winner?.team === 0 ? "A" : "B"} wins`
          : `${winner?.name ?? "Someone"} wins`;
  const reason =
    room.winReason === "domino"
      ? `${winner?.isMe ? "You" : winner?.name} played every tile.`
      : room.winReason === "blocked"
        ? "Nobody could move. Lowest pip count takes it."
        : "Nobody could move and the low pip counts tied. No points this round.";

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/50 backdrop-blur-[2px] sm:items-center sm:justify-center">
      <div className="w-full rounded-t-3xl bg-stone-900 p-5 pb-safe shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <h2 className="text-center text-2xl font-bold">{headline}</h2>
        <p className="mt-1 text-center text-sm text-stone-400">
          {room.matchOver ? `First to ${room.targetScore} points. ` : ""}
          {reason}
        </p>

        {isTeams && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            {[0, 1].map((t) => (
              <div key={t} className="rounded-xl bg-white/5 py-2">
                <p className="text-xs text-stone-400">Team {t === 0 ? "A" : "B"}</p>
                <p className="text-xl font-bold">{teamScore(t)}</p>
              </div>
            ))}
          </div>
        )}

        <ul className="mt-4 divide-y divide-white/5 rounded-xl bg-white/5">
          {seats.map((s) => (
            <li key={s.seatIndex} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {s.name}
                {s.isMe && <span className="text-stone-500"> (you)</span>}
                {s.seatIndex === room.winnerSeat && <span className="ml-1">🏆</span>}
              </span>
              <span className="text-stone-400">{s.finalPips ?? 0} pips left</span>
              <span className="w-14 text-right font-semibold">{s.score} pts</span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <TargetScoreToggle
            roomId={room.id}
            sessionId={sessionId}
            value={room.targetScore}
            editable={!!me?.isHost}
            onError={onError}
          />
        </div>

        {me?.isHost ? (
          <button
            onClick={onNext}
            className="mt-4 h-14 w-full rounded-xl bg-brass text-lg font-semibold text-stone-900 active:scale-[0.98]"
          >
            {room.matchOver ? "New match" : "Next round"}
          </button>
        ) : (
          <p className="mt-4 text-center text-sm text-stone-400">
            Waiting for the host to start the {room.matchOver ? "next match" : "next round"}…
          </p>
        )}
        <Link href="/" className="mt-2 block py-2 text-center text-sm text-stone-500">
          Back to lobby
        </Link>
      </div>
    </div>
  );
}
