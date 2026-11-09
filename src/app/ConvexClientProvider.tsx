"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!client) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">Convex isn&apos;t configured</h1>
          <p className="text-sm text-stone-300">
            Run <code className="rounded bg-black/40 px-1">npx convex dev</code> once. It creates a deployment and writes{" "}
            <code className="rounded bg-black/40 px-1">NEXT_PUBLIC_CONVEX_URL</code> to <code>.env.local</code>.
          </p>
        </div>
      </main>
    );
  }
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
