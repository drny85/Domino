import type { Metadata } from "next";
import { PrivacyContent } from "./PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy Policy · Capicúa: Dominoes Online",
  description: "What Capicúa: Dominoes Online stores, and what it never does.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
