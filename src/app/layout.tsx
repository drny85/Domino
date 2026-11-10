import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { LangInit } from "@/components/ui/LangToggle";

export const metadata: Metadata = {
  title: "Dominoes 3D",
  description: "Real-time multiplayer Double-Six dominoes: 1v1, 2v2 teams, or against the CPU.",
  applicationName: "Dominoes 3D",
  appleWebApp: { capable: true, title: "Dominoes", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2a1f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LangInit />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
