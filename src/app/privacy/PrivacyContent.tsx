"use client";

import Link from "next/link";
import { InfoPage, MailLink, type InfoCopy } from "@/components/ui/InfoPage";
import { PRIVACY_UPDATED, SUPPORT_EMAIL } from "@/lib/contact";
import type { Lang } from "@/lib/i18n";

const support = (label: string) => (
  <Link href="/support" className="font-semibold text-brass-light underline underline-offset-2">
    {label}
  </Link>
);

const COPY: Record<Lang, InfoCopy> = {
  en: {
    title: "Privacy Policy",
    intro:
      "Capicúa: Dominoes Online does not ask for an account, email or phone number. This policy covers the iPhone and iPad app and the web game at domino-3d.vercel.app.",
    sections: [
      {
        heading: "What we store",
        body: (
          <>
            <p>When you open the game it makes a random guest id on your device.</p>
            <p>
              The game server stores that id, the display name and avatar you choose, and the games you play, so other players in your
              room can see your name and moves.
            </p>
            <p>Your language, table theme and zoom are saved only on your device.</p>
          </>
        ),
      },
      {
        heading: "What we never do",
        body: <p>We don&apos;t sell this data, show ads or use tracking. There are no third-party analytics or advertising tools.</p>,
      },
      {
        heading: "Keeping and deleting data",
        body: (
          <p>
            Game records may be deleted at any time. To have your games removed sooner, email <MailLink email={SUPPORT_EMAIL} /> with
            your display name and a room code you played in.
          </p>
        ),
      },
      {
        heading: "Children",
        body: <p>The game collects no personal contact details from anyone, including children.</p>,
      },
      {
        heading: "Questions",
        body: <p>Write to the address on the {support("support page")}.</p>,
      },
    ],
    footnote: `Last updated ${PRIVACY_UPDATED}.`,
  },
  es: {
    title: "Política de privacidad",
    intro:
      "Capicúa: Dominoes Online no pide cuenta, correo ni número de teléfono. Esta política cubre la app para iPhone y iPad y el juego web en domino-3d.vercel.app.",
    sections: [
      {
        heading: "Qué guardamos",
        body: (
          <>
            <p>Al abrir el juego se crea un identificador de invitado al azar en tu dispositivo.</p>
            <p>
              El servidor del juego guarda ese identificador, el nombre y el avatar que elijas, y las partidas que juegas, para que los
              demás jugadores de tu sala vean tu nombre y tus jugadas.
            </p>
            <p>Tu idioma, el tema de la mesa y el zoom se guardan solo en tu dispositivo.</p>
          </>
        ),
      },
      {
        heading: "Lo que nunca hacemos",
        body: <p>No vendemos estos datos, no mostramos anuncios y no hacemos seguimiento. No usamos analíticas ni publicidad de terceros.</p>,
      },
      {
        heading: "Conservación y borrado",
        body: (
          <p>
            Los registros de partidas pueden borrarse en cualquier momento. Para que borremos tus partidas antes, escribe a{" "}
            <MailLink email={SUPPORT_EMAIL} /> con tu nombre en el juego y el código de una sala donde jugaste.
          </p>
        ),
      },
      {
        heading: "Menores",
        body: <p>El juego no recoge datos de contacto personales de nadie, tampoco de menores.</p>,
      },
      {
        heading: "Preguntas",
        body: <p>Escribe a la dirección de la {support("página de soporte")}.</p>,
      },
    ],
    footnote: `Última actualización: ${PRIVACY_UPDATED}.`,
  },
};

export function PrivacyContent() {
  return <InfoPage copy={COPY} />;
}
