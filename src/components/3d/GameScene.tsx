"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
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
import { Table } from "./Table";

export type GhostSpec = { side: Side; tile: Tile };

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
};

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

function Board({ board, openEnds, lastPlayedId, ghosts, onGhost, zoom, hand }: SceneProps) {
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
      {placed.map((t) => (
        <DominoTile
          key={t.id}
          a={t.a}
          b={t.b}
          position={[t.x, 0, t.z]}
          rotationY={t.rotY}
          highlight={t.id === lastPlayedId}
        />
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

export default function GameScene(props: SceneProps) {
  const scene = getScene(useThemeStore((s) => s.sceneId));
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      // Measure the layout box, not the on-screen box: the game screen may be CSS-rotated.
      resize={{ offsetSize: true }}
      // A tight depth range keeps close surfaces from shimmering at a distance.
      camera={{ fov: 42, position: [0, 14, 8], near: 2, far: 160 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={[scene.haze]} />
      <fog attach="fog" args={[scene.haze, 55, 95]} />
      <ambientLight intensity={0.18 + scene.ambient} />
      {/* Key light: a lamp above and slightly behind the player, casting soft shadows. */}
      <directionalLight
        position={[7, 18, 9]}
        intensity={2.3}
        color={scene.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={5}
      >
        <orthographicCamera attach="shadow-camera" args={[-17, 17, 17, -17, 1, 60]} />
      </directionalLight>
      <directionalLight position={[-8, 10, -6]} intensity={0.35} color="#ffe2b0" />
      <pointLight position={[0, 9, 0]} intensity={40} distance={30} decay={2} color="#ffd9a0" />
      <Suspense fallback={null}>
        {/* Procedural studio lighting: no HDR files are downloaded. */}
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={1.1} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[-6, 2, 4]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#ffe6c0" />
          <Lightformer form="ring" intensity={0.6} position={[6, 3, -4]} scale={4} color="#c8f0ff" />
        </Environment>
      </Suspense>
      <Table />
      <OpponentRack side="south" count={0} active={props.myTurn} />
      {props.racks.map((r) => (
        <OpponentRack key={r.side} {...r} />
      ))}
      <HandRack tiles={props.hand} onTap={props.onHandTap} />
      {props.drinks?.map((side) => <Drink key={side} side={side} />)}
      <BoneyardPile count={props.boneyardCount} />
      <Board {...props} />
      <FirstFrame onReady={props.onReady} />
    </Canvas>
  );
}
