"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Lang = "en" | "es";

/**
 * Spanish text, keyed by the English text used in the code. `{name}` style
 * placeholders are filled in by `translate`. Domino terms follow Caribbean
 * usage: ficha, pozo, puntas, tranque, capicúa.
 */
export const ES: Record<string, string> = {
  // Lobby
  Dominoes: "Dominó",
  "Double-Six · real-time · no sign-up": "Doble seis · en vivo · sin registro",
  "Your name": "Tu nombre",
  "e.g. Robert": "ej. Roberto",
  "Your avatar": "Tu avatar",
  Avatar: "Avatar",
  "Your record: {won} matches won, {lost} lost · {rounds} rounds won": "Tu récord: {won} partidas ganadas, {lost} perdidas · {rounds} manos ganadas",
  "{n} capicúas": "{n} capicúas",
  "best streak {n}": "mejor racha {n}",
  "New game": "Nueva partida",
  "Match type": "Tipo de partida",
  "1 vs 1": "1 contra 1",
  "Invite a friend": "Invita a un amigo",
  "2 vs 2": "2 contra 2",
  "Teams, partners sit across": "En parejas, tu compañero al frente",
  "vs CPU": "Contra la CPU",
  "Play solo right now": "Juega solo ahora mismo",
  "2 vs 2 teams": "2 contra 2 en parejas",
  Rules: "Reglas",
  "Draw game": "Con robo",
  "Block game": "Sin robo",
  "Points to win": "Puntos para ganar",
  "CPU level": "Nivel de la CPU",
  Easy: "Fácil",
  Normal: "Normal",
  Hard: "Difícil",
  "Can't play? Draw from the boneyard until you can.": "¿No tienes jugada? Roba del pozo hasta que puedas.",
  "Can't play? Pass. No drawing.": "¿No tienes jugada? Pasas. No se roba.",
  "Creating…": "Creando…",
  "Play vs CPU": "Jugar contra la CPU",
  "Create room": "Crear sala",
  "Join with a code": "Entrar con un código",
  "Room code": "Código de la sala",
  Join: "Entrar",
  "Enter a name to start.": "Escribe un nombre para empezar.",
  "Using a separate identity in this tab": "Usando otro jugador en esta pestaña",
  "Testing? Use a separate player in this tab": "¿Probando? Usa otro jugador en esta pestaña",
  "Install the app": "Instalar la app",
  "In Safari, tap the Share button, then “Add to Home Screen”. The game then opens full screen like an app.":
    "En Safari, toca el botón Compartir y luego “Agregar a inicio”. El juego se abre a pantalla completa como una app.",
  Language: "Idioma",

  // Joining and waiting room
  Loading: "Cargando",
  "Room {code} not found": "No se encontró la sala {code}",
  "Back to lobby": "Volver al inicio",
  "Join room {code}": "Entrar a la sala {code}",
  "{n}/{seats} seated": "{n}/{seats} sentados",
  "Joining…": "Entrando…",
  "Take a seat": "Sentarme",
  "This room is full.": "La sala está llena.",
  "This game has already started.": "La partida ya empezó.",
  "Join my dominoes game": "Únete a mi partida de dominó",
  "Room code {code}": "Código de la sala {code}",
  "Couldn't copy. The code is {code}": "No se pudo copiar. El código es {code}",
  "(you)": "(tú)",
  Host: "Anfitrión",
  Bot: "CPU",
  "Empty seat · tap to sit here": "Asiento libre · toca para sentarte",
  "Waiting for a player…": "Esperando a un jugador…",
  "Link copied": "Enlace copiado",
  "Share invite link": "Compartir invitación",
  "Hide QR": "Ocultar QR",
  "Show QR code": "Mostrar código QR",
  "Scan with a phone camera to join": "Escanéalo con la cámara del teléfono para entrar",
  "QR code with the invite link": "Código QR con el enlace de invitación",
  "Team {x}": "Equipo {x}",
  "Partners sit across from each other and share a score.": "Los compañeros se sientan de frente y comparten los puntos.",
  "Players {n}/{seats}": "Jugadores {n}/{seats}",
  "Start game": "Empezar partida",
  "Waiting for {n} more…": "Faltan {n}…",
  "Waiting for the host to start…": "Esperando a que el anfitrión empiece…",
  "Leave room": "Salir de la sala",
  "Turn timer": "Tiempo por turno",
  "Time runs out: the game plays for you": "Si se acaba el tiempo, el juego juega por ti",
  Off: "No",
  On: "Sí",
  Bonuses: "Bonos",
  "+25 capicúa, +25 when all three pass": "+25 por capicúa, +25 si los tres pasan",
  "+25 for a capicúa": "+25 por capicúa",

  // Table and background picker
  Table: "Mesa",
  "Change table and background": "Cambiar mesa y fondo",
  "Table and background": "Mesa y fondo",
  Done: "Listo",
  "Only you see your table and background.": "Solo tú ves tu mesa y tu fondo.",
  Background: "Fondo",
  Classic: "Clásicas",
  "Baseball teams": "Equipos de béisbol",
  Countries: "Países",
  "Game room": "Sala de juegos",
  Countryside: "Campo",
  Beach: "Playa",
  Bodega: "Bodega",
  Pool: "Piscina",
  House: "Casa",
  "Classic felt": "Paño clásico",
  "Midnight felt": "Paño azul noche",
  "Casino red": "Rojo casino",
  "Wood table": "Mesa de madera",
  "New York Navy": "Nueva York azul marino",
  "Boston Red": "Boston rojo",
  "Los Angeles Blue": "Los Ángeles azul",
  "Chicago Blue": "Chicago azul",
  "San Francisco Orange": "San Francisco naranja",
  "Licey Blue": "Licey azul",
  "Escogido Red": "Escogido rojo",
  "Águilas Yellow": "Águilas amarillo",
  "Dominican Republic": "República Dominicana",
  "United States": "Estados Unidos",
  Mexico: "México",
  Panama: "Panamá",
  Spain: "España",
  Japan: "Japón",

  // Game screen
  You: "Tú",
  Someone: "Alguien",
  Round: "Mano",
  Ends: "Puntas",
  "Open ends {left} and {right}": "Puntas abiertas {left} y {right}",
  "Setting the table…": "Preparando la mesa…",
  "Round over": "Fin de la mano",
  "Your lead: play any tile": "Tú sales: juega cualquier ficha",
  "No match: draw a tile": "No llevas: roba una ficha",
  "No match: pass": "No llevas: pasa",
  "Pick an end of the chain": "Elige una punta",
  "Your turn": "Tu turno",
  "CPU is thinking…": "La CPU está pensando…",
  "{name} is away: playing for them…": "{name} no está: se juega por él…",
  "{name}'s turn": "Turno de {name}",
  "Wait for your turn": "Espera tu turno",
  "Wait for {name}'s turn": "Espera, es el turno de {name}",
  "{tile} doesn't match {left} or {right}": "El {tile} no pega con {left} ni {right}",
  "You passed": "Pasaste",
  "{name} passed": "{name} pasó",
  "You drew a tile": "Robaste una ficha",
  "{name} drew a tile": "{name} robó una ficha",
  "You played {tile}": "Jugaste el {tile}",
  "{name} played {tile}": "{name} jugó el {tile}",
  "(played automatically)": "(jugada automática)",
  "Everyone passed! +{n} for you": "¡Pasaron todos! +{n} para ti",
  "Everyone passed! +{n} for {name}": "¡Pasaron todos! +{n} para {name}",
  "{n} seconds left": "Quedan {n} segundos",
  Reactions: "Reacciones",
  "Send a reaction": "Enviar una reacción",
  "Turn sound on": "Activar sonido",
  "Turn sound off": "Quitar sonido",
  "Zoom in": "Acercar",
  "Zoom out": "Alejar",
  "Left end ({n})": "Punta izquierda ({n})",
  "Right end ({n})": "Punta derecha ({n})",
  "Your tiles": "Tus fichas",
  Tile: "Ficha",
  playable: "se puede jugar",
  "Draw ({n})": "Robar ({n})",
  Pass: "Pasar",
  Tied: "Empate",
  "{name} ahead by {n}": "{name} con ventaja de {n}",
  "(away)": "(ausente)",
  "{n} tiles left": "Quedan {n} fichas",
  "1 tile left": "Queda 1 ficha",
  "{n} points": "{n} puntos",
  Score: "Marcador",
  "First to": "A",
  to: "a",
  Boneyard: "Pozo",
  partner: "compañero",

  // Round summary
  "Your team wins the match!": "¡Tu equipo gana la partida!",
  "You win the match!": "¡Ganaste la partida!",
  "{name} wins the match": "{name} gana la partida",
  "Blocked: it's a tie": "Tranque: empate",
  "Your team wins!": "¡Gana tu equipo!",
  "You win!": "¡Ganaste!",
  "{name} wins": "Gana {name}",
  "You played every tile.": "Jugaste todas tus fichas.",
  "{name} played every tile.": "{name} jugó todas sus fichas.",
  "Nobody could move. Lowest pip count takes it.": "Tranque: nadie podía jugar. Gana quien tiene menos puntos en la mano.",
  "Nobody could move and the low pip counts tied. No points this round.": "Tranque con empate en puntos. Nadie anota en esta mano.",
  "First to {n} points.": "A {n} puntos.",
  "+{n} points": "+{n} puntos",
  "includes a +{n} bonus": "incluye un bono de +{n}",
  "{n} pips left": "{n} puntos en mano",
  "House rules for the next round": "Reglas para la próxima mano",
  Rematch: "Revancha",
  "Next round": "Siguiente mano",
  "Waiting for the host to start the rematch…": "Esperando a que el anfitrión empiece la revancha…",
  "Waiting for the host to start the next round…": "Esperando a que el anfitrión empiece la siguiente mano…",

  // Messages from the server
  "Invalid session": "Sesión no válida",
  "Room not found": "No se encontró la sala",
  "The game is not in progress": "La partida no está en curso",
  "You are not seated in this room": "No estás sentado en esta sala",
  "It is not your turn": "No es tu turno",
  "That tile is not in your hand": "Esa ficha no está en tu mano",
  "That tile can't be played there": "Esa ficha no se puede jugar ahí",
  "You have a playable tile": "Tienes una ficha que puedes jugar",
  "No room with that code": "No hay ninguna sala con ese código",
  "This game has already started": "La partida ya empezó",
  "This is a private game against the CPU": "Es una partida privada contra la CPU",
  "This room is full": "La sala está llena",
  "You can't leave mid-round": "No puedes salir en medio de una mano",
  "Seats are locked once the game starts": "Los asientos se fijan cuando empieza la partida",
  "Invalid seat": "Asiento no válido",
  "You are not in this room": "No estás en esta sala",
  "That seat is taken": "Ese asiento está ocupado",
  "Only the host can change the target": "Solo el anfitrión puede cambiar los puntos",
  "Change the target between rounds": "Cambia los puntos entre manos",
  "Only the host can change the rules": "Solo el anfitrión puede cambiar las reglas",
  "Change the rules between rounds": "Cambia las reglas entre manos",
  "Unknown reaction": "Reacción desconocida",
  "The game is already in progress": "La partida ya está en curso",
  "Only the host can start the game": "Solo el anfitrión puede empezar la partida",
  "This match needs {n} players ({m} seated)": "Esta partida necesita {n} jugadores (hay {m} sentados)",
};

type Vars = Record<string, string | number | null | undefined>;

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const template = lang === "es" ? (ES[text] ?? text) : text;
  return vars ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m)) : template;
}

/** Server errors arrive in English; show the known ones in the player's language. */
export function translateError(lang: Lang, message: string): string {
  if (lang === "en") return message;
  const needs = message.match(/^This match needs (\d+) players \((\d+) seated\)$/);
  if (needs) return translate(lang, "This match needs {n} players ({m} seated)", { n: needs[1], m: needs[2] });
  return ES[message] ?? message;
}

export const useLangStore = create<{ lang: Lang; chosen: boolean; setLang: (lang: Lang) => void }>()(
  persist(
    (set) => ({
      lang: "en",
      /** False until the player picks a language themselves. */
      chosen: false,
      setLang: (lang) => set({ lang, chosen: true }),
    }),
    // Read after the first paint (see LangInit) so server and browser render the same HTML.
    { name: "domino.lang", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

/** Returns the translator for the current language: pass the English text and any values. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (text: string, vars?: Vars) => translate(lang, text, vars);
}
