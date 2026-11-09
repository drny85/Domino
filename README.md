# Dominoes 3D

Real-time multiplayer Double-Six dominoes in the browser, built mobile-first.

- **Match types:** 1 vs 1, 2 vs 2 teams (partners sit across and share a score), or 1 vs CPU.
- **Rules:** "Draw" (draw from the boneyard when stuck) or "Block" (pass when stuck).
- **Stack:** Next.js (App Router, TypeScript), Convex, React Three Fiber + drei, @react-spring/three, Zustand, Tailwind CSS v4.
- **No sign-up:** each browser gets a guest `sessionId` in `localStorage`.

## Run it

```bash
npm install
npx convex dev        # first run: log in / pick a project; writes NEXT_PUBLIC_CONVEX_URL to .env.local
npm run dev           # runs `next dev` and `convex dev` together
```

Open http://localhost:3000. To try multiplayer alone, open a second tab and tap
**"Testing? Use a separate player in this tab"** on the home screen (tabs share
`localStorage`, so this gives the tab its own identity via `sessionStorage`).

```bash
npm test              # rules, Convex functions (convex-test) and board-layout tests
npm run typecheck
npm run build
```

Deploy: `npx convex deploy` for the backend, then deploy the Next.js app (e.g. Vercel) with `NEXT_PUBLIC_CONVEX_URL` set.

## How it fits together

```
convex/
  schema.ts        rooms + players tables
  games.ts         all mutations/queries (server-authoritative)
  lib/rules.ts     pure rules: deal, shuffle, placement, blocking, scoring, CPU
src/
  app/             / (lobby) and /room/[code] (join, waiting room, game)
  components/3d/   DominoTile, Table, CameraRig, GameScene
  components/ui/   GameView (HUD + hand tray), WaitingRoom, DominoFace
  lib/             session (guest identity), boardLayout (snake layout), pips
  store/           Zustand UI state (selection, toasts)
```

### Server authority and anti-cheat

Clients only send intents: `playTile`, `drawOrPass`, `startGame`, etc. Every
rule check, the Fisher-Yates shuffle and the deal happen inside Convex
mutations. `api.games.getGameState({ roomId, sessionId })` is the one reactive
query the game screen uses; it returns:

- public room/board state (board, open ends, turn, boneyard **count**),
- the caller's own `hand`,
- sanitized opponents: `{ id, name, seatIndex, tileCount, score, isConnected }`
  plus `team`, `isBot`, and a pip **total** only after the round ends.

The boneyard, other players' tiles and other players' session ids are never
sent. (The host and winner are exposed as seat numbers rather than session ids,
because a session id is effectively a login token.)

### Game rules as implemented

- 28 tiles, 7 each. 1v1/CPU: 14 in the boneyard. 2v2: no boneyard.
- First player: highest double, else highest tile sum. They may lead any tile.
- Draw mode: with no playable tile you draw one at a time (turn stays with you)
  until you can play; with an empty boneyard you pass.
- Block mode: with no playable tile you pass.
- Domino: the player who empties their hand wins and scores every opponent's
  remaining pips (in 2v2, only the opposing team's pips count).
- Blocked: when nobody can play or draw, the lowest pip total (team total in
  2v2) wins and scores the opponents' pips. A tie for lowest scores nothing.
- After a round the host can start the next one; scores carry over.

### 3D

Everything is procedural: tiles are drei `RoundedBox` bodies with cylinder
pips, a divider and a brass spinner; the felt is a generated canvas texture;
lighting uses `<Environment>` with `<Lightformer>`s, so no HDR, `.glb` or font
files are downloaded. The chain is laid out as a snake that turns at the edge
of a row; rows are narrower on portrait screens, and the camera re-frames the
whole chain whenever it grows.
