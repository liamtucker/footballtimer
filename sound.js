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
 * WHY THE ALARM IS NOT A WHISTLE
 *
 * It was a whistle: band-passed noise around 3.4kHz with two detuned sawtooths
 * under it. It was inaudible on a touchline through a bluetooth speaker, and
 * the reason is measurable. Noise spreads its energy across a wide band, so
 * peak amplitude buys very little loudness. Rendered through an
 * OfflineAudioContext at 48kHz:
 *
 *     the old whistle   peak 0.344   RMS 0.075   crest 4.58   550ms
 *     this alarm        peak 0.936   RMS 0.469   crest 1.99   2499ms
 *
 * Six and a quarter times the RMS, which is 15.9dB, and it does not clip.
 * Stretching the old whistle to 2.5 seconds does not help: it measures RMS
 * 0.081. Through a band model of a portable speaker — 400Hz to 6kHz — the gap
 * is the same, 0.542 against 0.086.
 *
 * A tonal source is far louder for the same peak. The alarm is a two-tone
 * klaxon: square oscillators alternating between 1047Hz and 1397Hz, which is
 * where a small speaker and a human ear are both at their most sensitive, with
 * harmonics carrying above. A square wave's RMS is its own amplitude, so the
 * sound sits at the ceiling for its whole length instead of averaging a
 * fraction of it. A soft clipper holds the peak below 1 while the sum of two
 * detuned oscillators drifts in and out of phase.
 *
 * It alternates rather than holding one note because an alternating pair reads
 * as an alarm and a held note reads as a fault. Ten segments of 250ms is 2Hz,
 * which is the rate a European two-tone runs at.
 */

/* the alarm, end to end. long enough to carry, short enough to leave the ten
   second window to the voice */
export const ALARM_MS = 2500;

const ALARM_LOW = 1047;   /* C6 */
const ALARM_HIGH = 1397;  /* F6, a fourth up — the classic two-tone */
const SEGMENT_MS = 250;
/* measured: the graph peaks at 1/ALARM_TRIM before this, so this is what puts
   the rendered peak just under the ceiling instead of over it */
const ALARM_TRIM = 0.82;
const SEGMENT_GAP_MS = 18;

/*
 * A soft clipper. Two oscillators summed can reach 2.0 when they line up, and
 * a hard ceiling would buzz. This curve is flat-topped and smooth, so the sum
 * is squashed towards the ceiling instead of hitting it — which is also what
 * puts the RMS up near the peak.
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
 * The alarm. The same sound at kick-off and at every changeover.
 *
 * Returns its length in milliseconds.
 */
export function buildAlarm(ctx, at, out) {
  const seconds = ALARM_MS / 1000;
  const segment = SEGMENT_MS / 1000;
  const gap = SEGMENT_GAP_MS / 1000;
  const count = Math.round(seconds / segment);

  const shaper = clipper(ctx, 0.86);
  /* a square wave's top harmonics are fizz on a small driver and nothing on a
     big one. taking them off costs almost no loudness and a lot of harshness. */
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.setValueAtTime(6500, at);
  top.Q.setValueAtTime(0.5, at);
  /* the shaper bounds itself, but the filter after it overshoots on every
     square edge. the trim is what keeps the rendered peak under 1. */
  const trim = ctx.createGain();
  trim.gain.setValueAtTime(ALARM_TRIM, at);
  shaper.connect(top).connect(trim).connect(out);

  /* one envelope for the whole alarm, so the segments articulate inside it
     rather than each one fading up from nothing */
  const body = ctx.createGain();
  body.gain.setValueAtTime(0.0001, at);
  body.gain.linearRampToValueAtTime(1, at + 0.012);
  body.gain.setValueAtTime(1, at + seconds - 0.06);
  body.gain.linearRampToValueAtTime(0.0001, at + seconds);
  body.connect(shaper);

  /* the gate cuts a notch between segments. without it the two pitches slur
     into each other and it stops reading as two tones. */
  const gate = ctx.createGain();
  gate.gain.setValueAtTime(1, at);
  for (let i = 1; i < count; i += 1) {
    const edge = at + i * segment;
    gate.gain.setValueAtTime(1, edge - gap);
    gate.gain.linearRampToValueAtTime(0.06, edge - gap * 0.4);
    gate.gain.linearRampToValueAtTime(1, edge + gap * 0.6);
  }
  gate.connect(body);

  /* two oscillators, six cents apart. the beat between them is what stops a
     square wave sounding like a test tone. */
  for (const [detune, level] of [[0, 0.5], [6, 0.5]]) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.detune.setValueAtTime(detune, at);
    osc.frequency.setValueAtTime(ALARM_LOW, at);
    for (let i = 0; i < count; i += 1) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? ALARM_LOW : ALARM_HIGH, at + i * segment);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    osc.connect(g).connect(gate);
    osc.start(at);
    osc.stop(at + seconds + 0.02);
  }

  return ALARM_MS;
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
