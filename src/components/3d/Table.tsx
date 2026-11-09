"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getTheme, paintTheme } from "@/lib/themes";
import { useThemeStore } from "@/store/useThemeStore";

export const TABLE_RADIUS = 24;

export function Table() {
  const themeId = useThemeStore((s) => s.themeId);
  const theme = getTheme(themeId);

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    paintTheme(theme, canvas, 1024);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [theme]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group>
      {/* Table top: the theme's artwork */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[TABLE_RADIUS, 96]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
      {/* Rim in the theme's color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <torusGeometry args={[TABLE_RADIUS + 0.6, 0.75, 20, 128]} />
        <meshStandardMaterial color={theme.rim} roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Floor far below so the edge never shows a void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#08140f" roughness={1} />
      </mesh>
    </group>
  );
}
