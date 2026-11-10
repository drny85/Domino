"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { TABLE_HALF } from "./Table";

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

const TILT = THREE.MathUtils.degToRad(30);
/** Half-width shown by default on portrait screens, so tiles stay readable. */
const PORTRAIT_HALF_WIDTH = 8;

/**
 * Sits at the player's side of the table looking down at it, like a seated
 * player. It shows as much of the table as the screen allows while keeping
 * tiles readable, and pulls back further only when the chain needs it.
 * The +/- buttons scale the distance.
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
    const distForWidth = (halfW: number) => halfW / tanH;
    const distForDepth = (halfD: number) => (halfD * Math.cos(TILT)) / tanV + halfD * Math.sin(TILT);

    // Landscape: the whole table. Portrait: the full width would make tiles
    // tiny, so show a comfortable slice (both end rails stay in view).
    const whole = Math.max(distForWidth(TABLE_HALF), distForDepth(TABLE_HALF));
    const tableDist = aspect >= 1 ? whole : Math.min(whole, distForWidth(PORTRAIT_HALF_WIDTH));

    // The chain must always be fully visible.
    const margin = 1.4;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const chainDist = Math.max(
      distForWidth((bounds.maxX - bounds.minX) / 2 + margin),
      distForDepth((bounds.maxZ - bounds.minZ) / 2 + margin),
    );

    const dist = Math.max(tableDist, chainDist) * 1.02 * zoom;
    // Follow the chain a little, but stay anchored to the table.
    target.current.set(cx * 0.6, 0, cz * 0.6);
    desired.current.set(target.current.x, Math.cos(TILT) * dist, target.current.z + Math.sin(TILT) * dist);

    const k = 1 - Math.exp(-dt * 3.5);
    cam.position.lerp(desired.current, k);
    look.current.lerp(target.current, k);
    cam.lookAt(look.current);
  });

  return null;
}
