// Tiny WebAudio blips for the console. Off until the viewer turns sound on.
let ctx: AudioContext | null = null;
let on = false;

export const soundOn = () => on;
export function setSound(v: boolean) {
  on = v;
  if (v && !ctx) ctx = new AudioContext();
}

export function beep(freq = 880, dur = 0.05, type: OscillatorType = "square", vol = 0.03) {
  if (!on || !ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

export const chord = () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.04), i * 70));
export const err = () => beep(140, 0.25, "sawtooth", 0.04);
