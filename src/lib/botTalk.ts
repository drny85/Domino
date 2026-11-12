/**
 * Table talk for CPU seats: short lines the bots say as the game goes. Easy
 * bots are polite, hard bots are cocky, normal bots mix both. Same lines as
 * the iOS app. It is local only: the server never sees it.
 */
export type TalkEvent = "played" | "youStuck" | "passed" | "won" | "lost";

/** How often a bot speaks up for each event (0 to 1). */
export const TALK_CHANCE: Record<TalkEvent, number> = { played: 0.3, youStuck: 0.7, passed: 0.6, won: 1, lost: 1 };

/** A bot says at most one line in this long, except at the end of a round. */
export const TALK_GAP_MS = 4000;

type Pool = { es: string[]; en: string[] };
const LINES: Record<TalkEvent, { polite: Pool; cocky: Pool }> = {
  played: {
    polite: { es: ["Ahí te va.", "Con permiso.", "Una fichita.", "A ver qué haces."], en: ["There you go.", "Excuse me.", "Just a little one.", "Let's see what you do."] },
    cocky: { es: ["¡Toma!", "Esa te dolió.", "Aprende, mi hijo.", "¡Pa' que sepas!", "Esto es pan comido."], en: ["Take that!", "That one hurt.", "Watch and learn.", "Easy money.", "Piece of cake."] },
  },
  youStuck: {
    polite: { es: ["Tranquilo, ya te toca.", "Ay, qué mala suerte.", "Le pasa a cualquiera."], en: ["Don't worry, it happens.", "Oh, bad luck.", "Happens to everyone."] },
    cocky: {
      es: ["¿Y esa ficha? ¿No llevas?", "¡Te tengo trancao!", "¿Se te acabaron?", "Ve robando, que hay pa' rato.", "Eso no se juega así."],
      en: ["No tile? Really?", "Got you stuck!", "Out of moves already?", "Keep drawing, buddy.", "That's not how you play."],
    },
  },
  passed: {
    polite: { es: ["Paso, paso…", "Me pasaste, bien jugado."], en: ["Pass… well played.", "You got me there."] },
    cocky: { es: ["Paso, pero ya verás.", "Disfrútalo, que no dura.", "Ahorita me toca a mí."], en: ["Pass, but just wait.", "Enjoy it while it lasts.", "My turn's coming."] },
  },
  won: {
    polite: { es: ["¡Dominó! Buen juego.", "Gané esta, gracias por jugar."], en: ["Domino! Good game.", "Got this one, thanks for playing."] },
    cocky: {
      es: ["¡Dominó! ¡Pa' la casa!", "¡Siéntate, que esta mesa es mía!", "¿Quieres la revancha? Te la doy.", "¡Ni lo viste venir!"],
      en: ["Domino! Go home!", "Sit down, this table's mine!", "Want a rematch? Bring it.", "Didn't see that coming, huh?"],
    },
  },
  lost: {
    polite: { es: ["¡Bien jugado!", "Me ganaste, felicidades."], en: ["Well played!", "You got me, congrats."] },
    cocky: {
      es: ["Suerte de principiante.", "Esas fichas están marcadas.", "La próxima no te salvas.", "Eso fue pura suerte."],
      en: ["Beginner's luck.", "These tiles are rigged.", "You won't be so lucky next time.", "Pure luck."],
    },
  },
};

const pick = <T,>(list: T[], random: () => number) => list[Math.floor(random() * list.length)];

export function botLine(event: TalkEvent, level: string, lang: "en" | "es", random: () => number = Math.random): string {
  const polite = level === "easy" || (level !== "hard" && random() < 0.5);
  const pool = LINES[event][polite ? "polite" : "cocky"];
  return pick(lang === "es" ? pool.es : pool.en, random);
}

export const ALL_TALK_LINES = Object.values(LINES).flatMap((e) => [...e.polite.es, ...e.polite.en, ...e.cocky.es, ...e.cocky.en]);
