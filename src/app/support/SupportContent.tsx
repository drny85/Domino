"use client";

import Link from "next/link";
import { InfoPage, MailLink, type InfoCopy } from "@/components/ui/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/contact";
import type { Lang } from "@/lib/i18n";

const privacy = (label: string) => (
  <Link href="/privacy" className="font-semibold text-brass-light underline underline-offset-2">
    {label}
  </Link>
);

const COPY: Record<Lang, InfoCopy> = {
  en: {
    title: "Support",
    intro: (
      <>
        Need help, found a bug, or have an idea? Email <MailLink email={SUPPORT_EMAIL} />. We usually answer within a couple of days.
      </>
    ),
    sections: [
      {
        heading: "Play right away",
        body: <p>Tap “vs CPU”, then “Play vs CPU”. No sign-up needed.</p>,
      },
      {
        heading: "Play with friends",
        body: (
          <p>
            Pick “1 vs 1” or “2 vs 2” and tap “Create room”. Share the room code; friends enter it under “Join with a code” in the app or at
            domino-3d.vercel.app.
          </p>
        ),
      },
      {
        heading: "Reporting a problem",
        body: <p>Tell us your device, what happened, and the room code if you were in a game. A screenshot helps a lot.</p>,
      },
      {
        heading: "Your data",
        body: <p>See the {privacy("privacy policy")}. To have your games deleted, email us your display name and a room code.</p>,
      },
    ],
  },
  es: {
    title: "Soporte",
    intro: (
      <>
        ¿Necesitas ayuda, encontraste un error o tienes una idea? Escribe a <MailLink email={SUPPORT_EMAIL} />. Solemos responder en un par
        de días.
      </>
    ),
    sections: [
      {
        heading: "Juega ya",
        body: <p>Toca “Contra la CPU” y luego “Jugar contra la CPU”. No hace falta registrarse.</p>,
      },
      {
        heading: "Juega con amigos",
        body: (
          <p>
            Elige “1 contra 1” o “2 contra 2” y toca “Crear sala”. Comparte el código; tus amigos lo escriben en “Entrar con un código” en la
            app o en domino-3d.vercel.app.
          </p>
        ),
      },
      {
        heading: "Reportar un problema",
        body: <p>Dinos tu dispositivo, qué pasó y el código de la sala si estabas en una partida. Una captura de pantalla ayuda mucho.</p>,
      },
      {
        heading: "Tus datos",
        body: (
          <p>
            Mira la {privacy("política de privacidad")}. Para borrar tus partidas, escríbenos tu nombre en el juego y el código de una sala.
          </p>
        ),
      },
    ],
  },
};

export function SupportContent() {
  return <InfoPage copy={COPY} />;
}
