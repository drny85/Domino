"use client";

import { useMutation } from "convex/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Side, Tile } from "../../../convex/lib/rules";
import type { GhostSpec } from "@/components/3d/GameScene";
import type { RackSpec } from "@/components/3d/OpponentRack";
import { playSfx, unlockAudio } from "@/lib/sound";
import { releaseLandscape, tryLockLandscape, useGameViewport } from "@/lib/useGameViewport";
import type { GameState } from "@/lib/types";
import { useSettingsStore } from "@/store/useSettingsStore";
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
  const viewport = useGameViewport();
  const { compact } = viewport;
  // Phones: ask the browser to rotate on the first tap where it can (Android).
  const lockTried = useRef(false);
  useEffect(() => () => releaseLandscape(), []);
  // The 3D scene takes a moment to build; cover the canvas until its first frame.
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);

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
  const handSpecs = useMemo(
    () =>
      hand.map((t) => {
        const playable = !!me?.isMyTurn && playableMap.has(t.id);
        return {
          id: t.id,
          a: t.a,
          b: t.b,
          playable,
          selected: t.id === selectedTileId,
          dim: !!me?.isMyTurn && !playable && room.board.length > 0,
        };
      }),
    [hand, me?.isMyTurn, playableMap, selectedTileId, room.board.length],
  );
  // Stable callback for the 3D rack; always acts on the latest hand.
  const tapRef = useRef<(id: string) => void>(() => {});
  const onHandTap = useCallback((id: string) => tapRef.current(id), []);
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

  tapRef.current = (id) => {
    const tile = hand.find((t) => t.id === id);
    if (tile) {
      unlockAudio();
      onTileTap(tile);
    }
  };

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

  // Opponents sit around the table in turn order: next player on the right,
  // partner (or the only opponent) across, previous player on the left.
  const racks: RackSpec[] = others.map((o) => {
    const rel = (o.seatIndex - mySeat + seats.length) % seats.length;
    const side = seats.length === 2 ? "north" : rel === 1 ? "east" : rel === 2 ? "north" : "west";
    return { side, count: o.tileCount, active: room.status === "playing" && room.currentTurnSeat === o.seatIndex };
  });

  // Sounds and the big announcement banner, driven by server events.
  const { muted, toggleMuted } = useSettingsStore();
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const lastActionAt = room.lastAction?.at ?? 0;
  const seenAction = useRef(lastActionAt);
  useEffect(() => {
    const a = room.lastAction;
    if (!a || a.at === seenAction.current) return;
    seenAction.current = a.at;
    const who = seats.find((x) => x.seatIndex === a.seatIndex);
    const name = who?.isMe ? "You" : (who?.name ?? "Someone");
    if (!muted) playSfx(a.kind === "play" ? "place" : a.kind === "draw" ? "draw" : "pass");
    if (a.kind === "pass") setBanner({ id: a.at, text: `${name} passed` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastActionAt]);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 1500);
    return () => clearTimeout(id);
  }, [banner]);

  const isMyTurn = !!me?.isMyTurn;
  const wasMyTurn = useRef(isMyTurn);
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) {
      if (!muted) playSfx("turn");
      navigator.vibrate?.(20);
    }
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn, muted]);

  const finishedRound = room.status === "finished" ? room.round : 0;
  const announcedRound = useRef(finishedRound);
  useEffect(() => {
    if (finishedRound && finishedRound !== announcedRound.current && !muted) {
      const winner = seats.find((x) => x.seatIndex === room.winnerSeat);
      const mine = !!winner && !!me && (isTeams ? winner.team === me.team : winner.isMe);
      setTimeout(() => playSfx(mine ? "win" : "lose"), 350);
    }
    announcedRound.current = finishedRound;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedRound]);

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

  // The tally: my side first, then the other side (teams in 2v2).
  const myTeam = me?.team ?? 0;
  const scoreSides: ScoreSide[] = isTeams
    ? [myTeam, 1 - myTeam].map((team) => ({
        label: seats
          .filter((s) => s.team === team)
          .map((s) => (s.isMe ? "You" : s.name))
          .join(" & "),
        score: teamScore(team),
        mine: team === myTeam,
      }))
    : [...seats]
        .sort((a, b) => Number(b.isMe) - Number(a.isMe))
        .map((s) => ({
          label: s.isMe ? "You" : s.name,
          score: s.score,
          mine: s.isMe,
          tiles: s.tileCount,
          offline: !s.isMe && !s.isConnected,
          active: room.status === "playing" && room.currentTurnSeat === s.seatIndex,
        }));

  return (
    <main
      id="game-root"
      className={`fixed flex flex-col overflow-hidden bg-felt-900 ${viewport.rotate ? "" : "inset-0"}`}
      // Held upright on a phone: turn the whole game a quarter turn so it plays in landscape.
      style={
        viewport.rotate
          ? { top: 0, left: viewport.height, width: viewport.width, height: viewport.height, transform: "rotate(90deg)", transformOrigin: "top left" }
          : undefined
      }
      onPointerDown={() => {
        unlockAudio();
        if (viewport.rotate && !lockTried.current) {
          lockTried.current = true;
          void tryLockLandscape();
        }
      }}
    >
      {/* Top bar. On a phone in landscape it floats over the table. */}
      <header
        className={
          compact
            ? "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 px-2 pt-1.5 [&>*]:pointer-events-auto"
            : "z-10 flex flex-col gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pt-safe"
        }
      >
        <div className={`flex items-center gap-2 whitespace-nowrap text-xs text-stone-300 ${compact ? "order-1 rounded-full bg-black/45 pr-3 backdrop-blur" : ""}`}>
          <Link href="/" className="-ml-1 rounded-lg px-2 py-1.5 active:bg-white/10" aria-label="Back to lobby">
            ←
          </Link>
          <span className="font-mono tracking-widest text-brass-light">{room.code}</span>
          <span className="text-stone-500">·</span>
          <span>
            <span className="hidden min-[400px]:inline">Round </span>
            <span className="min-[400px]:hidden">R</span>
            {room.round}
          </span>

          {!compact && (
            <span className="ml-auto flex items-center gap-2">
              <ThemeButton className="py-1" />
            </span>
          )}
        </div>
        <div className={compact ? "order-2 mx-auto w-full max-w-sm" : ""}>
          <ScoreBoard
            sides={scoreSides}
            target={room.targetScore}
            boneyard={!isTeams && room.mode === "draw" ? room.boneyardCount : null}
            compact={compact}
          />
        </div>
        {compact && <ThemeButton className="order-3 bg-black/45 py-1.5 backdrop-blur" />}
        {/* Two-player games show the opponent inside the tally above. */}
        {isTeams && (
        <div className={compact ? "absolute left-2 top-12 flex w-32 flex-col gap-1" : "no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1"}>
          {others.map((o) => (
            <OpponentChip
              key={o.seatIndex}
              seat={o}
              active={room.status === "playing" && room.currentTurnSeat === o.seatIndex}
              partner={isTeams && me ? o.team === me.team : false}
              showTeam={isTeams}
            />
          ))}
        </div>
        )}
      </header>

      {/* 3D table */}
      <div className={compact ? "absolute inset-0" : "relative min-h-0 flex-1"}>
        <div className="absolute inset-0">
          <GameScene
            board={room.board}
            openEnds={room.openEnds}
            lastPlayedId={lastPlayedId}
            ghosts={ghosts}
            onGhost={(side) => selected && play(selected, side)}
            zoom={zoom}
            racks={racks}
            myTurn={isMyTurn}
            onReady={onSceneReady}
            hand={handSpecs}
            onHandTap={onHandTap}
            boneyardCount={room.mode === "draw" ? room.boneyardCount : 0}
          />
        </div>

        <div className={`pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1 ${compact ? "top-16" : "top-2"}`}>
          {activity && (
            <div className="max-w-[80%] truncate rounded-full bg-black/45 px-3 py-1 text-xs text-stone-200 backdrop-blur">{activity}</div>
          )}
          {banner && (
            <div
              key={banner.id}
              role="status"
              className="toast-in absolute left-1/2 top-24 w-max max-w-[90vw] rounded-2xl bg-black/75 px-6 py-3 text-xl font-bold text-white shadow-xl backdrop-blur"
            >
              {banner.text}
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

        {room.openEnds.left !== null && (
          <div
            className={`pointer-events-none absolute left-2 rounded-full bg-black/50 px-3 py-1 text-xs text-stone-200 backdrop-blur ${compact ? "bottom-12" : "top-2"}`}
            aria-label={`Open ends ${room.openEnds.left} and ${room.openEnds.right}`}
          >
            Ends <b className="text-white">{room.openEnds.left}</b> · <b className="text-white">{room.openEnds.right}</b>
          </div>
        )}
        {!sceneReady && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-felt-900">
            <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-brass" />
            <p className="text-xs text-stone-400">Setting the table…</p>
          </div>
        )}
      </div>

      {/* My hand */}
      <footer
        className={
          compact
            ? "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col-reverse [&_button]:pointer-events-auto"
            : "z-10 bg-gradient-to-t from-black/80 via-black/60 to-black/20 pb-safe"
        }
      >
        <div className={`flex items-center gap-2 px-3 ${compact ? "pb-1.5" : "pt-2"}`}>
          <span
            className={`size-2.5 rounded-full ${me?.isMyTurn ? "turn-pulse bg-brass-light" : "bg-stone-600"}`}
            aria-hidden
          />
          <p className={`min-w-0 truncate text-sm font-semibold ${compact ? "mr-auto rounded-full bg-black/45 px-3 py-1 backdrop-blur" : "flex-1"}`}>{turnText}</p>
<div className="flex shrink-0 gap-1">
            <button
              onClick={() => {
                unlockAudio();
                toggleMuted();
              }}
              className={`size-9 rounded-full text-sm ${compact ? "bg-black/50 backdrop-blur active:bg-black/70" : "bg-white/10 active:bg-white/20"}`}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              aria-pressed={!muted}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))} className={`size-9 rounded-full text-lg leading-none ${compact ? "bg-black/50 backdrop-blur active:bg-black/70" : "bg-white/10 active:bg-white/20"}`} aria-label="Zoom in">
              +
            </button>
            <button onClick={() => setZoom((z) => Math.min(2.6, z + 0.2))} className={`size-9 rounded-full text-lg leading-none ${compact ? "bg-black/50 backdrop-blur active:bg-black/70" : "bg-white/10 active:bg-white/20"}`} aria-label="Zoom out">
              −
            </button>
          </div>
        </div>

        {selected && selectedSides.length === 2 && (
          <div className={`flex gap-2 px-3 ${compact ? "mx-auto w-full max-w-md pb-1" : "pt-2"}`}>
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

        {/* The tiles themselves stand in the 3D rack; this list keeps them reachable by keyboard and screen readers. */}
        <ul className="sr-only" aria-label="Your tiles">
          {hand.map((t) => (
            <li key={t.id}>
              <button onClick={() => onTileTap(t)}>{`Tile ${t.a}-${t.b}${playableMap.has(t.id) ? ", playable" : ""}`}</button>
            </li>
          ))}
        </ul>
        <div className={`flex justify-center px-3 ${compact ? "pb-1" : "min-h-3 pb-2 pt-2"}`}>
          {me?.canDrawOrPass && (
            <button
              disabled={pending}
              onClick={onDrawOrPass}
              className="turn-pulse h-12 w-full max-w-sm rounded-xl bg-brass px-5 font-semibold text-stone-900 active:scale-95 disabled:opacity-50"
            >
              {me.willDraw ? `Draw (${room.boneyardCount})` : "Pass"}
            </button>
          )}
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

type ScoreSide = {
  label: string;
  score: number;
  mine: boolean;
  /** Tiles in hand (two-player games, where the tally doubles as the opponent panel). */
  tiles?: number;
  offline?: boolean;
  /** This side is to move. */
  active?: boolean;
};

/** Match tally: both scores, how close each is to the target, and who leads. */
function ScoreBoard({
  sides,
  target,
  boneyard,
  compact = false,
}: {
  sides: ScoreSide[];
  target: number;
  boneyard: number | null;
  compact?: boolean;
}) {
  if (sides.length < 2) return null;
  const [a, b] = sides;
  const lead = a.score - b.score;
  const status = lead === 0 ? "Tied" : `${lead > 0 ? a.label : b.label} ${(lead > 0 ? a.label : b.label) === "You" ? "lead" : "leads"} by ${Math.abs(lead)}`;
  const side = (s: ScoreSide, leading: boolean, align: "left" | "right") => (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : ""}`}>
      <div className={`flex items-baseline gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span className={`font-bold tabular-nums leading-none ${compact ? "text-lg" : "text-2xl"} ${leading ? "text-brass-light" : "text-white"}`}>{s.score}</span>
        <span className={`min-w-0 truncate text-xs ${leading ? "font-semibold text-brass-light" : "text-stone-300"}`}>
          {leading && <span aria-hidden>★ </span>}
          {s.label}
          {s.offline && <span className="text-stone-500"> (away)</span>}
        </span>
        {s.tiles !== undefined && !s.mine && (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              s.tiles <= 2 ? "bg-red-500/80 text-white" : "bg-white/10 text-stone-200"
            } ${s.active ? "ring-1 ring-brass-light" : ""}`}
            aria-label={`${s.tiles} tiles left`}
          >
            {s.tiles}
            <span className="ml-1 inline-block h-3 w-1.5 rounded-[2px] bg-ivory align-[-1px]" aria-hidden />
          </span>
        )}
      </div>
      <div className={`mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/10 ${align === "right" ? "justify-end" : ""}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${leading ? "bg-brass-light" : s.mine ? "bg-emerald-400" : "bg-stone-400"}`}
          style={{ width: `${Math.min(100, (s.score / target) * 100)}%` }}
        />
      </div>
    </div>
  );
  return (
    <section
      className={`flex items-center gap-3 rounded-xl border border-white/10 px-3 ${compact ? "bg-black/55 py-1 backdrop-blur" : "bg-black/35 py-2"}`}
      aria-label={`Score: ${a.label} ${a.score}, ${b.label} ${b.score}, playing to ${target}. ${status}.`}
    >
      {side(a, lead > 0, "left")}
      <div className="shrink-0 text-center leading-tight">
        {!compact && <p className="text-[10px] uppercase tracking-wide text-stone-400">First to</p>}
        <p className="text-sm font-bold text-white">
          {compact && <span className="text-[10px] font-normal text-stone-400">to </span>}
          {target}
        </p>
        <p className={`text-[10px] ${lead === 0 ? "text-stone-400" : "text-brass-light"}`}>{lead === 0 ? "Tied" : `+${Math.abs(lead)}`}</p>
        {boneyard !== null && <p className="text-[10px] text-stone-400">Boneyard {boneyard}</p>}
      </div>
      {side(b, lead < 0, "right")}
    </section>
  );
}

function OpponentChip({ seat, active, partner, showTeam }: { seat: Seat; active: boolean; partner: boolean; showTeam: boolean }) {
  const low = seat.tileCount <= 2;
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1 rounded-xl border px-2.5 py-1.5 sm:max-w-56 ${
        active ? "turn-pulse border-brass-light bg-brass/15" : "border-white/10 bg-black/40"
      }`}
      aria-label={`${seat.name}: ${seat.tileCount} ${seat.tileCount === 1 ? "tile" : "tiles"} left, ${seat.score} points`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${seat.isConnected ? "bg-emerald-400" : "bg-stone-500"}`} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{seat.name}</span>
      </div>
      <div className="flex items-center gap-1.5" aria-hidden>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-base font-bold tabular-nums leading-none ${
            low ? "bg-red-500/30 text-red-100" : "bg-white/10"
          }`}
        >
          {seat.tileCount}
        </span>
        {/* One face-down tile per tile they hold. */}
        <div className="flex min-w-0 flex-wrap gap-[2px]">
          {Array.from({ length: seat.tileCount }).map((_, i) => (
            <span key={i} className="h-3 w-[6px] rounded-[2px] border border-stone-400/70 bg-stone-200" />
          ))}
        </div>
      </div>
      <p className="truncate text-[11px] leading-none text-stone-400">
        {seat.tileCount === 1 ? "1 tile left" : `${seat.tileCount} tiles left`}
        {showTeam && <> · {partner ? "partner" : seat.team === 0 ? "A" : "B"}</>}
      </p>
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
