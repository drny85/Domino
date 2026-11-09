"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * Keeps the whole chain in view. Looks down at a steep angle and picks the
 * distance from the camera's FOV and the screen's aspect ratio, so the same
 * board fits a portrait phone and a widescreen monitor. Eases toward the
 * target each frame, and lets the player zoom with the slider factor.
 */
export function CameraRig({ bounds, zoom = 1 }: { bounds: Bounds; zoom?: number }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const margin = 1.6;
    const halfW = Math.max((bounds.maxX - bounds.minX) / 2 + margin, 3.2);
    const halfD = Math.max((bounds.maxZ - bounds.minZ) / 2 + margin, 3.2);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;

    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * aspect;
    // Tilt from vertical; foreshortening of depth handled by the cos term.
    const tilt = THREE.MathUtils.degToRad(28);
    const dist = Math.max(halfW / tanH, (halfD * Math.cos(tilt)) / tanV + halfD * Math.sin(tilt)) * 1.05 * zoom;

    target.current.set(cx, 0, cz);
    desired.current.set(cx, Math.cos(tilt) * dist, cz + Math.sin(tilt) * dist);

    const k = 1 - Math.exp(-dt * 4);
    cam.position.lerp(desired.current, k);
    look.current.lerp(target.current, k);
    cam.lookAt(look.current);
  });

  return null;
}
