import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const tileValidator = v.object({ id: v.string(), a: v.number(), b: v.number() });

export const boardTileValidator = v.object({
  id: v.string(),
  a: v.number(),
  b: v.number(),
  isDouble: v.boolean(),
  placedSide: v.union(v.literal("root"), v.literal("left"), v.literal("right")),
  flipped: v.boolean(),
});

export const modeValidator = v.union(v.literal("draw"), v.literal("block"));
export const targetScoreValidator = v.union(v.literal(100), v.literal(200));
export const cpuLevelValidator = v.union(v.literal("easy"), v.literal("normal"), v.literal("hard"));
export const turnSecondsValidator = v.union(v.literal(0), v.literal(20), v.literal(30));
export const matchTypeValidator = v.union(v.literal("1v1"), v.literal("2v2"), v.literal("cpu"), v.literal("watch"));

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    status: v.union(v.literal("waiting"), v.literal("playing"), v.literal("finished")),
    hostSessionId: v.string(),
    mode: modeValidator,
    currentTurnSeat: v.number(),
    openEnds: v.object({ left: v.nullable(v.number()), right: v.nullable(v.number()) }),
    board: v.array(boardTileValidator),
    boneyard: v.array(tileValidator),
    winnerSessionId: v.optional(v.string()),
    winReason: v.optional(v.string()),
    // Additions beyond the base spec:
    matchType: matchTypeValidator,
    // Points a player (or team, in 2v2) needs to win the match. Default 200.
    targetScore: v.optional(targetScoreValidator),
    matchOver: v.optional(v.boolean()),
    matchWinnerTeam: v.optional(v.number()),
    round: v.optional(v.number()),
    consecutivePasses: v.optional(v.number()),
    lastAction: v.optional(
      v.object({
        seatIndex: v.number(),
        kind: v.string(),
        tileId: v.optional(v.string()),
        at: v.number(),
        // True when the server played for an absent or timed-out player.
        auto: v.optional(v.boolean()),
      }),
    ),
    // Host options.
    turnSeconds: v.optional(turnSecondsValidator),
    bonuses: v.optional(v.boolean()),
    cpuLevel: v.optional(cpuLevelValidator),
    // Turn clock: `turnId` grows every time the turn moves on.
    turnId: v.optional(v.number()),
    timerTurnId: v.optional(v.number()),
    // The turn whose clock was restarted once because the player's table was still loading.
    graceTurnId: v.optional(v.number()),
    turnDeadline: v.optional(v.number()),
    // Per seat: numbers that player could not match this round (public knowledge).
    voids: v.optional(v.array(v.array(v.number()))),
    // Rules the host changed after the match began, announced to every player.
    rulesChange: v.optional(
      v.object({
        at: v.number(),
        changes: v.array(v.object({ key: v.string(), value: v.string() })),
        // Set once the round that uses the new rules has been dealt.
        applied: v.optional(v.boolean()),
      }),
    ),
    lastRound: v.optional(
      v.object({ points: v.number(), bonus: v.number(), bonusKind: v.optional(v.string()) }),
    ),
    bonusEvent: v.optional(v.object({ seatIndex: v.number(), kind: v.string(), points: v.number(), at: v.number() })),
  }).index("by_code", ["code"]),

  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
    seatIndex: v.number(),
    hand: v.array(tileValidator),
    score: v.number(),
    isBot: v.optional(v.boolean()),
    // Heartbeat timestamp used to derive `isConnected`.
    lastSeen: v.optional(v.number()),
    avatar: v.optional(v.string()),
    reaction: v.optional(v.object({ text: v.string(), at: v.number() })),
    // Asked for a drink: one stands in the cup holder on their right.
    drink: v.optional(v.boolean()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionId"]),
});
