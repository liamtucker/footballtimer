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
 * WHY IT SWELLS, AND WHY THAT COST NOTHING
 *
 * The held horn was still harsh, and three things made it so: it started in
 * twenty milliseconds, it stopped in a hundred and twenty, and it carried
 * 6.5kHz of top on a stack driven four times over. All three are the sound of
 * a switch and not of an object.
 *
 * So the note now swells over 110ms on a curve, holds, and lets go over 320ms;
 * the top comes up with it, from 2.2kHz to 5kHz, and closes again on the way
 * out. The throat opening is what a real horn does and it is the whole
 * difference between an alarm and an announcement.
 *
 * The interval changed with it. Bb3 and Eb4 is a fourth, which is the
 * interval a truck air horn is built to and it grinds on purpose. Bb3 and F4
 * is a fifth: consonant, and — this is the part that matters on a pitch —
 * measurably louder through a small speaker, because F4 at 349Hz sits higher
 * in the band a phone can actually pass than Eb4 at 311Hz.
 *
 * Modelled at 48kHz and normalised to the old horn's peak, so RMS is a
 * like-for-like loudness number, and band-RMS is what a 400Hz-6kHz speaker
 * passes:
 *
 *     the old whistle          RMS 0.075   band-RMS 0.086
 *     the klaxon               RMS 0.469
 *     the fourth, hard edges   RMS 0.600   band-RMS 0.417
 *     this horn                RMS 0.578   band-RMS 0.420
 *
 * Two percent of RMS bought the swell and the release, and the fifth gave it
 * back through the speaker that has to carry it. It is not a quieter horn.
 *
 * HOW IT IS BUILT
 *
 * Two throats, Bb3 and F4, a fifth apart and sounding together. Each throat is
 * a pair of sawtooths six or seven cents apart, so the pair drifts in and out
 * of phase and never sits still. The stack is driven into a soft clipper,
 * which is what turns a thin sawtooth chord into something with a throat: the
 * clipper folds the harmonics up through 400Hz to 5kHz, which is where a small
 * speaker and a human ear are both at their most sensitive.
 *
 * The pitch climbs 45 cents into the note and drops 60 cents out of it. A real
 * horn does both — the air has to catch and it has to run out — and it is the
 * detail that makes this read as an object rather than as an oscillator.
 */

/* the horn, end to end. long enough to carry, short enough to leave the ten
   second window to the voice */
export const HORN_MS = 2500;

const HORN_LOW = 233.08;    /* Bb3 */
const HORN_HIGH = 349.23;   /* F4, a fifth up — the two throats of the horn */
/* how hard the stack is pushed into the clipper. this is the timbre control:
   under two it is a synth chord, over six it is a buzz. */
const HORN_DRIVE = 4.2;
/* measured: the graph peaks at 1/HORN_TRIM before this, so this is what puts
   the rendered peak just under the ceiling instead of over it */
const HORN_TRIM = 0.74;
const HORN_RISE = 45;   /* cents the pitch climbs as the air catches */
const HORN_FALL = 60;   /* cents it drops as the air runs out */
const RISE_S = 0.11;
const FALL_S = 0.34;

/* the swell and the let-go. the attack is a curve and not a ramp, because a
   straight line into a held note is still an edge — it is the second half of
   the rise that has to be slow, not the first. */
const ATTACK_S = 0.11;
const RELEASE_S = 0.32;

/* the throat opening. the top comes up with the note and closes on the way
   out, which is the difference between a horn and a switch. */
const TOP_SHUT = 2200;
const TOP_OPEN = 5000;

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

/** The attack, as a curve. `x^1.7` is slow where a ramp is fastest. */
function swell(points) {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i += 1) {
    curve[i] = Math.max(0.0001, Math.pow(i / (points - 1), 1.7));
  }
  return curve;
}

/**
 * The horn. The same sound at kick-off and at every changeover.
 *
 * Returns its length in milliseconds.
 */
export function buildHorn(ctx, at, out) {
  const seconds = HORN_MS / 1000;

  const shaper = clipper(ctx, 0.9);
  /* the top of a clipped sawtooth stack is fizz on a small driver and nothing
     on a big one. taking it off costs almost no loudness and a lot of
     harshness — and moving it is the throat opening and closing. */
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.setValueAtTime(TOP_SHUT, at);
  top.frequency.linearRampToValueAtTime(TOP_OPEN, at + ATTACK_S + 0.07);
  top.frequency.setValueAtTime(TOP_OPEN, at + seconds - RELEASE_S);
  top.frequency.linearRampToValueAtTime(3000, at + seconds);
  top.Q.setValueAtTime(0.6, at);
  /* the shaper bounds itself, but the filter after it overshoots on every
     edge. the trim is what keeps the rendered peak under 1. */
  const trim = ctx.createGain();
  trim.gain.setValueAtTime(HORN_TRIM, at);
  shaper.connect(top).connect(trim).connect(out);

  /* one envelope for the whole horn. it is a held note, so there is nothing
     inside it to articulate — only a swell in and a let-go out, both long
     enough to read as air moving rather than as a contact closing. */
  const body = ctx.createGain();
  /* the curve owns the start of the note. An explicit setValueAtTime at the
     same instant is an event inside a curve's span, which Safari throws on. */
  body.gain.setValueCurveAtTime(swell(64), at, ATTACK_S);
  body.gain.setValueAtTime(1, at + seconds - RELEASE_S);
  body.gain.linearRampToValueAtTime(0.0001, at + seconds);
  body.connect(shaper);

  /* the drive is before the envelope, so the clipper sees less signal as the
     note swells — which is why the timbre opens with the level instead of
     arriving whole */
  const drive = ctx.createGain();
  drive.gain.setValueAtTime(HORN_DRIVE, at);
  drive.connect(body);

  const fallAt = at + seconds - FALL_S;
  /* two throats a fifth apart, each a beating pair */
  for (const [freq, cents, level] of [
    [HORN_LOW, 0, 0.5],
    [HORN_LOW, -7, 0.5],
    [HORN_HIGH, 0, 0.44],
    [HORN_HIGH, 6, 0.44]
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

/*
 * The ten seconds before a rotation. One a second, and the horn at zero.
 *
 * It is the chime's first tone and not the kick-off tick, because those are
 * two different jobs. The tick is a hair under the hearing floor on purpose —
 * it counts a kick-off in on a phone held in a hand. This one has to carry
 * across a pitch through the same speaker the horn does, so it is built the
 * same way the chime is: a fundamental with two partials over it, which is
 * what survives a cheap bluetooth driver.
 */
export function buildBeep(ctx, at, out) {
  tone(ctx, out, 880, at, 0.1, 0.5);
  return 100;
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
