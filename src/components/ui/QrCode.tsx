"use client";

import { useT } from "@/lib/i18n";
import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** A QR code drawn as one SVG path, so it stays sharp at any size. */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  const t = useT();
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { size: n + 4, path: d };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={t("QR code with the invite link")} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" rx="1.5" />
      <path d={path} fill="#111" />
    </svg>
  );
}
