import type { Metadata } from "next";
import { SupportContent } from "./SupportContent";

export const metadata: Metadata = {
  title: "Support · Capicúa: Dominoes Online",
  description: "Help with Capicúa: Dominoes Online, and how to reach us.",
};

export default function SupportPage() {
  return <SupportContent />;
}
