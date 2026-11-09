"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import type { BoardTile, OpenEnds, Side, Tile } from "../../../convex/lib/rules";
import { placeTile } from "../../../convex/lib/rules";
import { footprint, layoutBoard } from "@/lib/boardLayout";
import { CameraRig, type Bounds } from "./CameraRig";
import { DominoTile } from "./DominoTile";
import { Table } from "./Table";

export type GhostSpec = { side: Side; tile: Tile };

type SceneProps = {
  board: BoardTile[];
  openEnds: OpenEnds;
  lastPlayedId: string | null;
  ghosts: GhostSpec[];
  onGhost: (side: Side) => void;
  zoom: number;
};

/** Narrower rows on portrait screens so the snake grows downward. */
function rowLimitFor(aspect: number) {
  if (aspect < 0.75) return 3.5;
  if (aspect < 1.25) return 5.5;
  return 8;
}

function Board({ board, openEnds, lastPlayedId, ghosts, onGhost, zoom }: SceneProps) {
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
    if (all.length === 0) return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
    return all.map(footprint).reduce((acc, f) => ({
      minX: Math.min(acc.minX, f.minX),
      maxX: Math.max(acc.maxX, f.maxX),
      minZ: Math.min(acc.minZ, f.minZ),
      maxZ: Math.max(acc.maxZ, f.maxZ),
    }));
  }, [placed, ghostPlacements]);

  return (
    <>
      <CameraRig bounds={bounds} zoom={zoom} />
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
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 42, position: [0, 14, 8], near: 0.1, far: 300 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#08140f"]} />
      <fog attach="fog" args={["#08140f", 40, 90]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 14, 8]} intensity={1.6} />
      <directionalLight position={[-8, 10, -6]} intensity={0.4} color="#ffe2b0" />
      <Suspense fallback={null}>
        {/* Procedural studio lighting: no HDR files are downloaded. */}
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[-6, 2, 4]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#ffe6c0" />
          <Lightformer form="ring" intensity={0.6} position={[6, 3, -4]} scale={4} color="#c8f0ff" />
        </Environment>
      </Suspense>
      <Table />
      <ContactShadows position={[0, 0.005, 0]} scale={44} resolution={512} blur={2.2} opacity={0.55} far={2} />
      <Board {...props} />
    </Canvas>
  );
}
