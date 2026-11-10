"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { handLayout } from "./HandRack";
import { RACK_Z, TABLE_HALF } from "./Table";

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

const TILT = THREE.MathUtils.degToRad(33);
const SIN = Math.sin(TILT);
const COS = Math.cos(TILT);
/** Portrait screens never zoom in past this half-width, so a short chain is not huge. */
const PORTRAIT_MIN_HALF_WIDTH = 4.6;
/** Canvases shorter than this (a phone on its side) also use the close framing. */
const CLOSE_MAX_HEIGHT = 520;

type Point = [x: number, y: number, z: number];

/**
 * Sits at the player's side of the table looking down at it, like a seated
 * player. Wide screens show the whole table. Phones held upright come in
 * close: just the chain and the player's own rack, so tiles stay readable.
 * The +/- buttons scale the distance.
 */
export function CameraRig({ bounds, zoom = 1, handCount = 7 }: { bounds: Bounds; zoom?: number; handCount?: number }) {
  const { camera, size } = useThree();
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const tanH = tanV * aspect;

    const portrait = aspect < 1;
    // Phones, upright or on their side, come in close; big screens show the whole table.
    const close = portrait || size.height < CLOSE_MAX_HEIGHT;
    const hand = handLayout(handCount, portrait);
    const handHalf = hand.halfWidth + 0.35;
    const handTop = 2.1 * hand.scale + 0.8;

    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    // Follow the chain a little, but stay anchored to the table. Portrait
    // leans toward the player, where the chain and the rack both are.
    target.current.set(cx * 0.6, 0, close ? Math.max(cz * 0.6, 0) + 3 : cz * 0.6 + 1);
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

    const margin = close ? 0.9 : 1.4;
    const points: Point[] = [
      // The player's hand, standing in the near rack.
      [-handHalf, 0.6, RACK_Z],
      [handHalf, 0.6, RACK_Z],
      [0, handTop, RACK_Z],
      // The near edge, plus room for the bar that floats over it on phones.
      [0, 0.4, TABLE_HALF + (close && !portrait ? 1.6 : 0.2)],
      // The chain.
      [bounds.minX - margin, 0, bounds.minZ - margin],
      [bounds.maxX + margin, 0, bounds.minZ - margin],
      [bounds.minX - margin, 0, bounds.maxZ + margin],
      [bounds.maxX + margin, 0, bounds.maxZ + margin],
    ];
    if (close) {
      points.push([tx - PORTRAIT_MIN_HALF_WIDTH, 0, tz], [tx + PORTRAIT_MIN_HALF_WIDTH, 0, tz]);
    } else {
      // Room for the far rack and the whole table, corner blocks included.
      points.push([0, 2.8, -RACK_Z]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push([sx * (TABLE_HALF + 0.4), 0.6, sz * (TABLE_HALF + 0.4)]);
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
