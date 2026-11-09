import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

export type GameState = NonNullable<FunctionReturnType<typeof api.games.getGameState>>;
export type Me = NonNullable<GameState["me"]>;
export type Opponent = GameState["opponents"][number];
