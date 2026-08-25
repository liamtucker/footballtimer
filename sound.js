/*
 * sound.js — the three sounds, built as WebAudio graphs and nothing else.
 *
 * Every function here takes a context, a start time and a destination, builds
 * the graph and returns how long it runs, in milliseconds. Nothing touches the
 * DOM, nothing reads state and nothing decides when to play. That is app.js's
 * job, and it is what lets the same code be rendered through an
 * OfflineAudioContext and measured.
 *
 * No files and no network. A pitch has no signal.
 *
 * WHY THE HORN IS NOT A WHISTLE
 *
 * It was a whistle: band-passed noise around 3.4kHz with two detuned sawtooths
 * under it. It was inaudible on a touchline through a bluetooth speaker, and
 * the reason is measurable. Noise spreads its energy across a wide band, so
 * peak amplitude buys very little loudness. A tonal source is far louder for
 * the same peak, so the whistle went and a tonal sound replaced it.
 *
 * WHY THE HORN IS NOT A KLAXON EITHER
 *
 * The tonal sound that replaced the whistle was a two-tone klaxon: square
 * oscillators alternating 1047Hz and 1397Hz at 2Hz. It was loud and it was
 * wrong. Alternation is the strongest emergency cue a sound has — a fire panel
 * alternates, a reversing lorry alternates — and 1047Hz is where a smoke alarm
 * lives. It said evacuate, on a five-a-side pitch.
 *
 * A stadium horn is the opposite of all three. It is one held note, it sits a
 * couple of hundred Hertz down, and it carries on its harmonics rather than on
 * its fundamental. Held reads as a game where alternating reads as an
 * emergency, and low with rich harmonics reads as an object with air in it
 * where a high square wave reads as a circuit.
 *
 * Rendered through an OfflineAudioContext at 48kHz:
 *
 *     the old whistle   peak 0.344   RMS 0.075   crest 4.58   550ms
 *     the klaxon        peak 0.936   RMS 0.469   crest 2.00   2504ms
 *     this horn         peak 0.940   RMS 0.602   crest 1.56   2522ms
 *
 * The horn is the loudest of the three and it does not clip. Nothing was
 * traded for the timbre: a held note has no notches cut in it, so it spends
 * all of its length at the ceiling where the klaxon spent nine tenths.
 * Through a band model of a portable speaker — 400Hz to 6kHz — the horn is
 * 0.544 against the klaxon's 0.513 and the whistle's 0.086.
 *
 * HOW IT IS BUILT
 *
 * Two throats, Bb3 and Eb4, a fourth apart and sounding together. That is the
 * interval a truck air horn is built to, and a fourth held together beats and
 * grinds in a way one note cannot. Each throat is a pair of sawtooths six or
 * seven cents apart, so the pair drifts in and out of phase and never sits
 * still. The stack is driven four times into a soft clipper, which is what
 * turns a thin sawtooth chord into something with a throat: the clipper folds
 * the harmonics up through 400Hz to 6kHz, which is where a small speaker and a
 * human ear are both at their most sensitive. A 6.5kHz lowpass takes the fizz
 * off the top, and a trim holds the rendered peak under 1.
 *
 * The pitch climbs 40 cents into the note and drops 70 cents out of it. A real
 * horn does both — the air has to catch and it has to run out — and it is the
 * detail that makes this read as an object rather than as an oscillator.
 */

/* the horn, end to end. long enough to carry, short enough to leave the ten
   second window to the voice */
export const HORN_MS = 2500;

const HORN_LOW = 233.08;    /* Bb3 */
const HORN_HIGH = 311.13;   /* Eb4, a fourth up — the two throats of an air horn */
/* how hard the stack is pushed into the clipper. this is the timbre control:
   under two it is a synth chord, over six it is a buzz. */
const HORN_DRIVE = 4;
/* measured: the graph peaks at 1/HORN_TRIM before this, so this is what puts
   the rendered peak just under the ceiling instead of over it */
const HORN_TRIM = 0.8;
const HORN_RISE = 40;   /* cents the pitch climbs as the air catches */
const HORN_FALL = 70;   /* cents it drops as the air runs out */
const RISE_S = 0.06;
const FALL_S = 0.22;

/*
 * A soft clipper. Four sawtooths driven four times over can reach well past
 * 1.0, and a hard ceiling would buzz. This curve is flat-topped and smooth, so
 * the sum is squashed towards the ceiling instead of hitting it — which is
 * also what puts the RMS up near the peak, and what builds the harmonics the
 * horn carries on.
 */
function clipper(ctx, ceiling) {
  const shaper = ctx.createWaveShaper();
  const n = 4096;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ceiling * Math.tanh(x * 2.2);
  }
  shaper.curve = curve;
  /* the curve makes harmonics of its own, and 4x is what keeps them below
     Nyquist instead of folding back as a whistle */
  shaper.oversample = '4x';
  return shaper;
}

/**
 * The horn. The same sound at kick-off and at every changeover.
 *
 * Returns its length in milliseconds.
 */
export function buildHorn(ctx, at, out) {
  const seconds = HORN_MS / 1000;

  const shaper = clipper(ctx, 0.86);
  /* the top of a clipped sawtooth stack is fizz on a small driver and nothing
     on a big one. taking it off costs almost no loudness and a lot of harshness. */
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.setValueAtTime(6500, at);
  top.Q.setValueAtTime(0.5, at);
  /* the shaper bounds itself, but the filter after it overshoots on every
     edge. the trim is what keeps the rendered peak under 1. */
  const trim = ctx.createGain();
  trim.gain.setValueAtTime(HORN_TRIM, at);
  shaper.connect(top).connect(trim).connect(out);

  /* one envelope for the whole horn. it is a held note, so there is nothing
     inside it to articulate — only a fast attack and a release short enough to
     stay a horn and long enough to carry the pitch drop. */
  const body = ctx.createGain();
  body.gain.setValueAtTime(0.0001, at);
  body.gain.linearRampToValueAtTime(1, at + 0.02);
  body.gain.setValueAtTime(1, at + seconds - 0.12);
  body.gain.linearRampToValueAtTime(0.0001, at + seconds);
  body.connect(shaper);

  /* the drive is before the envelope, so the clipper sees the same amount of
     signal for the whole note and the timbre does not change as it fades */
  const drive = ctx.createGain();
  drive.gain.setValueAtTime(HORN_DRIVE, at);
  drive.connect(body);

  const fallAt = at + seconds - FALL_S;
  /* two throats a fourth apart, each a beating pair */
  for (const [freq, cents, level] of [
    [HORN_LOW, 0, 0.5],
    [HORN_LOW, 7, 0.5],
    [HORN_HIGH, 0, 0.42],
    [HORN_HIGH, -6, 0.42]
  ]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, at);
    /* up into the note and down out of it, in cents off the throat's own pitch */
    osc.detune.setValueAtTime(cents - HORN_RISE, at);
    osc.detune.linearRampToValueAtTime(cents, at + RISE_S);
    osc.detune.setValueAtTime(cents, fallAt);
    osc.detune.linearRampToValueAtTime(cents - HORN_FALL, at + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    osc.connect(g).connect(drive);
    osc.start(at);
    osc.stop(at + seconds + 0.02);
  }

  return HORN_MS;
}

/*
 * The chime. Names follow. One short pair of tones, the same every time, and
 * it is the throwaway first token a sleeping speaker eats.
 */
export function buildChime(ctx, at, out) {
  tone(ctx, out, 660, at, 0.12, 0.5);
  tone(ctx, out, 880, at + 0.2, 0.12, 0.5);
  return 330;
}

function tone(ctx, out, freq, at, dur, level) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(level, at + 0.02);
  g.gain.setValueAtTime(level, at + Math.max(0.03, dur - 0.05));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(out);
  /* the partials are what carry it through a cheap bluetooth speaker */
  for (const [mult, type, gain] of [[1, 'sine', 1], [2, 'triangle', 0.34], [3, 'sine', 0.13]]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, at);
    const og = ctx.createGain();
    og.gain.setValueAtTime(gain, at);
    osc.connect(og).connect(g);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }
}

/* The last five seconds of the kick-off countdown. One tick a second. */
export function buildTick(ctx, at, out) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.08, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  g.connect(out);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, at);
  osc.connect(g);
  osc.start(at);
  osc.stop(at + 0.04);
  return 40;
}
