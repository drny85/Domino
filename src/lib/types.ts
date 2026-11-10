import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

type ServerState = NonNullable<FunctionReturnType<typeof api.games.getGameState>>;
type Presence = FunctionReturnType<typeof api.games.getPresence>;

/** The game as the server sends it, plus who is online (which arrives separately). */
export type GameState = Omit<ServerState, "opponents"> & {
  opponents: (ServerState["opponents"][number] & { isConnected: boolean })[];
};
export type Me = NonNullable<GameState["me"]>;
export type Opponent = GameState["opponents"][number];

/** A player counts as connected if they were heard from this recently. */
const CONNECTED_WINDOW_MS = 30_000;
/** Matches the server: a host silent this long may be stood in for. */
const AWAY_MS = 40_000;

/**
 * Folds presence into the game state. `elapsed` is how long ago the presence
 * answer arrived, so the result keeps ageing between answers.
 */
export function withPresence(state: ServerState, presence: Presence | undefined, elapsed: number): GameState {
  const age = (seat: number | null) => {
    const row = presence?.seats.find((s) => s.seatIndex === seat);
    return presence && row ? presence.now - row.lastSeen + elapsed : Infinity;
  };
  const hostAway = presence !== undefined && age(state.room.hostSeat) > AWAY_MS;
  return {
    ...state,
    me: state.me ? { ...state.me, canStart: state.me.canStart || (state.me.canStartIfHostAway && hostAway) } : null,
    // Until presence arrives, assume people are there rather than flash everyone as away.
    opponents: state.opponents.map((o) => ({ ...o, isConnected: o.isBot || presence === undefined || age(o.seatIndex) < CONNECTED_WINDOW_MS })),
  };
}
