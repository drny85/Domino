"use client";

/**
 * Sound effects synthesized with the Web Audio API (no audio files).
 * The context is created lazily on the first user gesture, as browsers require.
 */

export type Sfx = "place" | "draw" | "pass" | "turn" | "win" | "lose" | "select" | "slam" | "slamBig";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** Call from a tap/click handler so later sounds are allowed to play. */
export function unlockAudio() {
  audio();
}

function noiseBuffer(ac: AudioContext) {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A hard tile hitting wood: a filtered noise click plus a short low knock. */
function clack(ac: AudioContext, t: number, gain = 1) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2600;
  band.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.5 * gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(band).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + 0.08);

  const knock = ac.createOscillator();
  knock.type = "sine";
  knock.frequency.setValueAtTime(240, t);
  knock.frequency.exponentialRampToValueAtTime(90, t + 0.09);
  const kg = ac.createGain();
  kg.gain.setValueAtTime(0.45 * gain, t);
  kg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  knock.connect(kg).connect(ac.destination);
  knock.start(t);
  knock.stop(t + 0.13);
}

function tone(ac: AudioContext, t: number, freq: number, dur: number, gain = 0.18, type: OscillatorType = "triangle") {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** The winning tile slammed down: a heavy low thud under a hard clack. */
function thud(ac: AudioContext, t: number, gain: number) {
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.9 * gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + 0.5);
  clack(ac, t, 1.4 * gain);
}

export function playSfx(kind: Sfx) {
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime + 0.01;
  switch (kind) {
    case "place":
      clack(ac, t);
      clack(ac, t + 0.055, 0.35); // the tile settling
      break;
    case "draw":
      clack(ac, t, 0.35);
      tone(ac, t, 520, 0.09, 0.05, "sine");
      break;
    case "select":
      clack(ac, t, 0.2);
      break;
    case "pass":
      // Two knocks on the table, the traditional way to pass.
      clack(ac, t, 0.7);
      clack(ac, t + 0.16, 0.7);
      break;
    case "slam":
      thud(ac, t, 1);
      // The other tiles landing after their hop.
      clack(ac, t + 0.33, 0.3);
      clack(ac, t + 0.37, 0.25);
      break;
    case "slamBig":
      thud(ac, t, 1.3);
      clack(ac, t + 0.36, 0.4);
      clack(ac, t + 0.4, 0.35);
      clack(ac, t + 0.45, 0.3);
      break;
    case "turn":
      tone(ac, t, 880, 0.18, 0.08, "sine");
      break;
    case "win":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, t + i * 0.11, f, 0.32));
      break;
    case "lose":
      [392, 329.63, 261.63].forEach((f, i) => tone(ac, t + i * 0.16, f, 0.35, 0.12));
      break;
  }
}
