"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { RACK_LENGTH, RACK_Z, TABLE_HALF } from "./Table";

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

const TILT = THREE.MathUtils.degToRad(33);
const SIN = Math.sin(TILT);
const COS = Math.cos(TILT);
/** Half-width of the table shown by default on portrait screens, so tiles stay readable. */
const PORTRAIT_HALF_WIDTH = 8;
/** The view is centred a little toward the player, whose standing tiles need the room. */
const TARGET_BIAS_Z = 1;
/** Half-width of the player's hand in its rack, with a small margin. */
const HAND_HALF = (RACK_LENGTH + 1.2) / 2 + 0.5;

type Point = [x: number, y: number, z: number];

/**
 * Sits at the player's side of the table looking down at it, like a seated
 * player. It always keeps the player's rack, the far rack and the whole
 * chain in view, shows the full table when the screen is wide enough, and
 * the +/- buttons scale the distance.
 */
export function CameraRig({ bounds, zoom = 1 }: { bounds: Bounds; zoom?: number }) {
  const { camera, size } = useThree();
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const tanH = tanV * aspect;

    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    // Follow the chain a little, but stay anchored to the table.
    target.current.set(cx * 0.6, 0, cz * 0.6 + TARGET_BIAS_Z);
    const tx = target.current.x;
    const tz = target.current.z;

    // Smallest camera distance that keeps a world point inside the frame.
    const need = ([x, y, z]: Point) => {
      const rx = x - tx;
      const rz = z - tz;
      const along = y * COS + rz * SIN; // how far the point sits toward the camera
      const up = y * SIN - rz * COS; // offset along the camera's up axis
      return Math.max(Math.abs(rx) / tanH, Math.abs(up) / tanV) + along;
    };

    const margin = 1.4;
    const points: Point[] = [
      // The player's hand, standing in the near rack.
      [-HAND_HALF, 0.6, RACK_Z],
      [HAND_HALF, 0.6, RACK_Z],
      [0, 3, RACK_Z],
      [0, 0.4, TABLE_HALF],
      // The far rack and the tiles on it.
      [0, 2.8, -RACK_Z],
      // The chain.
      [bounds.minX - margin, 0, bounds.minZ - margin],
      [bounds.maxX + margin, 0, bounds.minZ - margin],
      [bounds.minX - margin, 0, bounds.maxZ + margin],
      [bounds.maxX + margin, 0, bounds.maxZ + margin],
    ];
    if (aspect >= 1) {
      // Room for the whole table, corner blocks included.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push([sx * (TABLE_HALF + 0.4), 0.6, sz * (TABLE_HALF + 0.4)]);
    } else {
      // Portrait: the full width would make tiles tiny, so show a comfortable slice.
      points.push([tx - PORTRAIT_HALF_WIDTH, 0, tz], [tx + PORTRAIT_HALF_WIDTH, 0, tz]);
    }

    const dist = Math.max(...points.map(need)) * 1.02 * zoom;
    desired.current.set(tx, COS * dist, tz + SIN * dist);

    const k = 1 - Math.exp(-dt * 3.5);
    cam.position.lerp(desired.current, k);
    look.current.lerp(target.current, k);
    cam.lookAt(look.current);
  });

  return null;
}
