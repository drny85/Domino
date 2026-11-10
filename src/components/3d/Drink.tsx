"use client";

import { animated, useSpring } from "@react-spring/three";
import type { RackSide } from "./OpponentRack";
import { CUP_OFFSET, CUP_Y } from "./Table";

/** The cup holder on each player's right hand, as they sit facing the table. */
const HOLDER: Record<RackSide, [number, number]> = {
  south: [CUP_OFFSET, CUP_OFFSET],
  north: [-CUP_OFFSET, -CUP_OFFSET],
  east: [CUP_OFFSET, -CUP_OFFSET],
  west: [-CUP_OFFSET, CUP_OFFSET],
};

const HEIGHT = 1.7;

/** A tall glass of rum and cola with ice, a lime wedge and a straw, set down in a cup holder. */
export function Drink({ side }: { side: RackSide }) {
  const [x, z] = HOLDER[side];
  // Lowered into the holder from above when it is served.
  const { drop, scale } = useSpring({ from: { drop: 4, scale: 0.4 }, to: { drop: 0, scale: 1 }, config: { tension: 170, friction: 16 } });
  return (
    <animated.group position-x={x} position-z={z} position-y={drop.to((d) => CUP_Y + d)} scale={scale}>
      {/* Liquid */}
      <mesh position={[0, HEIGHT * 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.47, HEIGHT * 0.76, 28]} />
        <meshStandardMaterial color="#5a2408" roughness={0.25} emissive="#3a1404" emissiveIntensity={0.35} />
      </mesh>
      {/* Glass */}
      <mesh position={[0, HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.68, 0.5, HEIGHT, 28, 1, true]} />
        <meshStandardMaterial color="#dff3ff" transparent opacity={0.3} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.06, 28]} />
        <meshStandardMaterial color="#c9dde8" roughness={0.1} />
      </mesh>
      <mesh position={[0, HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.025, 8, 36]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </mesh>
      {/* Ice */}
      {[
        [0.18, 0.05, 0.5],
        [-0.22, -0.12, 0.2],
        [0.02, 0.24, 1.1],
      ].map(([ix, iz, r], i) => (
        <mesh key={i} position={[ix, HEIGHT * 0.78, iz]} rotation={[r, r * 2, r]}>
          <boxGeometry args={[0.34, 0.34, 0.34]} />
          <meshStandardMaterial color="#f4fbff" transparent opacity={0.85} roughness={0.15} />
        </mesh>
      ))}
      {/* Lime wedge on the rim */}
      <mesh position={[0.62, HEIGHT + 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.09, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#8fd14f" roughness={0.5} />
      </mesh>
      {/* Straw */}
      <mesh position={[-0.2, HEIGHT * 0.72, -0.1]} rotation={[0.12, 0, 0.22]}>
        <cylinderGeometry args={[0.045, 0.045, HEIGHT * 1.15, 10]} />
        <meshStandardMaterial color="#e63946" roughness={0.5} />
      </mesh>
    </animated.group>
  );
}
