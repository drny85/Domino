"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BoardTile, OpenEnds, Side, Tile } from "../../../convex/lib/rules";
import { placeTile } from "../../../convex/lib/rules";
import { footprint, layoutBoard } from "@/lib/boardLayout";
import { getScene } from "@/lib/scenes";
import { useThemeStore } from "@/store/useThemeStore";
import { CameraRig, type Bounds } from "./CameraRig";
import { BoneyardPile } from "./BoneyardPile";
import { DominoTile } from "./DominoTile";
import { HandRack, type HandTileSpec } from "./HandRack";
import { Drink } from "./Drink";
import { OpponentRack, type RackSide, type RackSpec } from "./OpponentRack";
import { SceneProps } from "./SceneProps";
import { Table } from "./Table";

export type GhostSpec = { side: Side; tile: Tile };
/** The round's winning tile, slammed onto the table. `big` for a capicúa. */
export type SlamSpec = { key: string; tileId: string; big: boolean };

type SceneProps = {
  board: BoardTile[];
  openEnds: OpenEnds;
  lastPlayedId: string | null;
  ghosts: GhostSpec[];
  onGhost: (side: Side) => void;
  zoom: number;
  /** Opponents' hands, shown as face-down tiles on their racks. */
  racks: RackSpec[];
  /** Sides of the table whose player asked for a drink. */
  drinks?: RackSide[];
  /** Lights the strip on the player's own (south) rail. */
  myTurn: boolean;
  /** The player's own tiles, standing in their rack. */
  hand: HandTileSpec[];
  onHandTap: (id: string) => void;
  /** Face-down tiles left to draw (0 hides the pile). */
  boneyardCount: number;
  /** Called once, after the first frame has been drawn. */
  onReady?: () => void;
  slam?: SlamSpec | null;
};

const SLAM_DROP_S = 0.22;
const SLAM_HOP_S = 0.36;
const SLAM_SHAKE_S = 0.45;

/**
 * Plays the winning slam: the last tile drops hard from above, then the table
 * shakes and every other tile hops. Driven by the clock in useFrame (the
 * canvas only draws on demand, so it asks for frames while it runs).
 */
function SlamDriver({
  slam,
  tiles,
  table,
}: {
  slam: SlamSpec | null | undefined;
  tiles: React.MutableRefObject<Map<string, THREE.Group>>;
  table: React.MutableRefObject<THREE.Group | null>;
}) {
  const invalidate = useThree((st) => st.invalidate);
  const run = useRef<{ key: string; start: number; hops: Map<string, { h: number; tilt: number }> } | null>(null);
  // A round that was already over when the table opened is not replayed.
  const seen = useRef<string | null>(slam?.key ?? null);
  useEffect(() => {
    if (!slam || seen.current === slam.key) return;
    seen.current = slam.key;
    const lift = slam.big ? 0.45 : 0.28;
    const hops = new Map<string, { h: number; tilt: number }>();
    tiles.current.forEach((_, id) => {
      if (id !== slam.tileId) hops.set(id, { h: lift * (0.6 + Math.random() * 0.4), tilt: (Math.random() - 0.5) * 0.5 });
    });
    run.current = { key: slam.key, start: performance.now(), hops };
    invalidate();
  }, [slam, tiles, invalidate]);

  useFrame(() => {
    const r = run.current;
    if (!r || !slam) return;
    const t = (performance.now() - r.start) / 1000;
    const tile = tiles.current.get(slam.tileId);
    if (tile) {
      const k = Math.min(t / SLAM_DROP_S, 1);
      tile.position.y = 3.4 * (1 - k * k); // easing in: fastest as it hits
      tile.rotation.x = 0.4 * (1 - k);
    }
    const after = t - SLAM_DROP_S;
    const hopK = after > 0 && after < SLAM_HOP_S ? Math.sin((Math.PI * after) / SLAM_HOP_S) : 0;
    r.hops.forEach((hop, id) => {
      const g = tiles.current.get(id);
      if (!g) return;
      g.position.y = hop.h * hopK;
      g.rotation.z = hop.tilt * hopK;
    });
    if (table.current) {
      const shakeK = after > 0 && after < SLAM_SHAKE_S ? 1 - after / SLAM_SHAKE_S : 0;
      const amp = (slam.big ? 0.16 : 0.1) * shakeK;
      table.current.position.set(Math.sin(after * 90) * amp, 0, Math.cos(after * 77) * amp * 0.6);
    }
    if (after < Math.max(SLAM_HOP_S, SLAM_SHAKE_S)) invalidate();
    else {
      run.current = null;
      if (tile) tile.position.y = 0;
      if (table.current) table.current.position.set(0, 0, 0);
    }
  });
  return null;
}

function FirstFrame({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      // The frame being drawn now is on screen by the next tick.
      requestAnimationFrame(() => onReady?.());
    }
  });
  return null;
}

/** Narrower rows on portrait screens so the snake grows downward. */
function rowLimitFor(aspect: number) {
  if (aspect < 0.8) return 3.5;
  if (aspect < 1.25) return 4.5;
  return 6;
}

function Board({ board, openEnds, lastPlayedId, ghosts, onGhost, zoom, hand, slam, tableRef }: SceneProps & { tableRef: React.MutableRefObject<THREE.Group | null> }) {
  const tileRefs = useRef(new Map<string, THREE.Group>());
  const handCount = hand.length;
  const { size } = useThree();
  const limit = rowLimitFor(size.width / Math.max(size.height, 1));

  const placed = useMemo(() => layoutBoard(board, limit), [board, limit]);

  const ghostPlacements = useMemo(
    () =>
      ghosts.flatMap(({ side, tile }) => {
        try {
          const next = placeTile(tile, side, board, openEnds);
          const p = layoutBoard(next.board, limit).find((t) => t.id === tile.id);
          return p ? [{ side, p }] : [];
        } catch {
          return [];
        }
      }),
    [ghosts, board, openEnds, limit],
  );

  const bounds = useMemo<Bounds>(() => {
    const all = [...placed, ...ghostPlacements.map((g) => g.p)];
    if (all.length === 0) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
    return all.map(footprint).reduce((acc, f) => ({
      minX: Math.min(acc.minX, f.minX),
      maxX: Math.max(acc.maxX, f.maxX),
      minZ: Math.min(acc.minZ, f.minZ),
      maxZ: Math.max(acc.maxZ, f.maxZ),
    }));
  }, [placed, ghostPlacements]);

  return (
    <>
      <CameraRig bounds={bounds} zoom={zoom} handCount={handCount} />
      <SlamDriver slam={slam} tiles={tileRefs} table={tableRef} />
      {placed.map((t) => (
        <group
          key={t.id}
          ref={(g) => {
            if (g) tileRefs.current.set(t.id, g);
            else tileRefs.current.delete(t.id);
          }}
        >
          <DominoTile
            a={t.a}
            b={t.b}
            position={[t.x, 0, t.z]}
            rotationY={t.rotY}
            highlight={t.id === lastPlayedId}
            // The slammed tile falls by the slam, not by the usual soft drop.
            dropIn={t.id !== slam?.tileId}
          />
        </group>
      ))}
      {ghostPlacements.map(({ side, p }) => (
        <DominoTile
          key={`ghost-${side}-${p.id}`}
          a={p.a}
          b={p.b}
          position={[p.x, 0.02, p.z]}
          rotationY={p.rotY}
          ghost
          dropIn={false}
          onSelect={() => onGhost(side)}
        />
      ))}
    </>
  );
}

function GameScene(props: SceneProps) {
  const scene = getScene(useThemeStore((s) => s.sceneId));
  const tableRef = useRef<THREE.Group | null>(null);
  return (
    <Canvas
      shadows
      // Draw only when something moves: an idle table costs the phone nothing.
      frameloop="demand"
      dpr={[1, 2]}
      // Measure the layout box, not the on-screen box: the game screen may be CSS-rotated.
      resize={{ offsetSize: true }}
      // A tight depth range keeps close surfaces from shimmering at a distance.
      camera={{ fov: 42, position: [0, 14, 8], near: 2, far: 160 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={[scene.haze]} />
      <fog attach="fog" args={[scene.haze, 55, 95]} />
      {/* Sky light from above, warm bounce from the floor below. */}
      <hemisphereLight args={["#fff6e6", "#6b4a30", 0.35 + scene.ambient]} />
      {/* Key light: above and slightly behind the player, casting soft shadows. */}
      <directionalLight
        position={[7, 18, 9]}
        intensity={2.2}
        color={scene.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={6}
      >
        <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 1, 60]} />
      </directionalLight>
      {/* The lamp over the table: a warm pool on the felt that falls off toward the rails. */}
      <spotLight position={[0, 15, 1]} angle={0.72} penumbra={0.9} intensity={150} decay={2} distance={40} color="#ffe8c4" />
      {/* Low light from the player's side, so the faces of their own tiles read bright. */}
      <directionalLight position={[0, 9, 22]} intensity={0.7} color="#fff3e0" />
      <directionalLight position={[-8, 10, -6]} intensity={0.4} color="#ffe2b0" />
      <Suspense fallback={null}>
        {/* Procedural studio lighting: no HDR files are downloaded. */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={["#2a241e"]} />
          <Lightformer form="rect" intensity={1.3} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[14, 10, 1]} color="#fff4e2" />
          <Lightformer form="rect" intensity={0.8} position={[-8, 3, 4]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} color="#ffe6c0" />
          <Lightformer form="rect" intensity={0.7} position={[8, 3, -2]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} color="#dff0ff" />
          <Lightformer form="rect" intensity={0.6} position={[0, 3, 10]} rotation-y={Math.PI} scale={[12, 3, 1]} color="#ffffff" />
        </Environment>
      </Suspense>
      <SceneProps sceneId={scene.id} />
      {/* Everything on the table, so the winning slam can shake it as one. */}
      <group ref={tableRef}>
        <Table />
        <OpponentRack side="south" count={0} active={props.myTurn} />
        {props.racks.map((r) => (
          <OpponentRack key={r.side} {...r} />
        ))}
        <HandRack tiles={props.hand} onTap={props.onHandTap} />
        {props.drinks?.map((side) => <Drink key={side} side={side} />)}
        <BoneyardPile count={props.boneyardCount} />
        <Board {...props} tableRef={tableRef} />
      </group>
      <FirstFrame onReady={props.onReady} />
    </Canvas>
  );
}

// The parent redraws often (timers, reactions); the table only when its own inputs change.
export default memo(GameScene);
