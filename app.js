/*
 * app.js — the two screens around rotation.js.
 *
 * rotation.js holds the whole rota and nothing here recomputes any part of it.
 * This file owns the team select, the game screen, the modal, the sounds, the
 * voice, the wake lock and persistence.
 *
 * WHAT LEFT, AND WHY IT IS SMALLER
 *
 * Who starts on the pitch is drawn at kick-off, in the engine, and written
 * into the setup. Entry order decides nothing. That single change deletes
 * three controls at once: the subs divider had nothing to divide, the drag had
 * nothing to order, and a tap that set the starting keeper was setting
 * something the draw sets. With them went the edit route, because the game
 * screen the design describes has one control on it and it is `END`.
 *
 * WHAT A NAME CARRIES
 *
 * Two flags, both toggles, both set from the modal:
 *
 *   fixedGoalie   in goal all game, never on the bench. Everyone else still
 *                 rotates through the bench around them.
 *   late          moved to the end of the rotation, so they are furthest from
 *                 goal and furthest from the bench — and they still get a turn.
 *
 * The engine owns what both mean. This file writes them onto the players and
 * reads the answer back.
 *
 * THE COUNTDOWN IS ONE THING IN TWO PLACES
 *
 * Twenty seconds before kick-off and ten before every rotation, and the same
 * treatment: the gauge empties and the block is the grey underneath, whole.
 * At a rotation it is not a state arriving — it is the gauge running out,
 * which is what the block has been saying all shift.
 */

/*
 * A namespace import, not named ones. The engine is being rewritten beside
 * this file and a named import of an export that has not landed yet is a link
 * error that takes the whole app down before a line of it runs. This way a
 * missing export is `undefined`, and the two places that could be missing one
 * are the settings cyclers, which fall back.
 */
import * as engine from './rotation.js';
import { buildHorn, buildChime, buildTick, buildBeep, HORN_MS } from './sound.js';

const MS_PER_MINUTE = 60000;
const NAME_MAX = 10;

/* the last ten seconds of every shift: the warning, and the grey */
const WINDOW_MS = 10000;
/* and the twenty before the first one */
const KICKOFF_S = 20;

/* the silence between the horn ending and the first chime */
const VOICE_GAP_MS = 150;

const TEAM_NAMES = ['Team A', 'Team B'];

const COPY = {
  goalkeepers: 'Goalkeepers',
  subs: 'Subs',
  nextRotation: 'Next rotation:',
  paused: 'Paused',
  kickOffIn: 'Kick off in:',
  rotateEvery: 'Rotate every',
  dash: '\u2014',
  fixedGoalie: 'Fixed goalie',
  late: 'Late',
  endTitle: 'End the game?',
  endYes: 'End',
  endNo: 'Keep playing',
  soundTest: 'Sound is working.'
};

/* ------------------------------------------------------------- storage */

const KEY_GAME = 'rota.game2';
const KEY_SQUAD = 'rota.squad2';

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* a full or blocked store is not worth a message on a touchline */
  }
}

function dropKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) { /* ignore */ }
}

/* --------------------------------------------------------------- clock */

/*
 * Debug hook. Inert unless `?t=` is in the URL. Nothing is written to
 * localStorage while it is on and `window.rota` does not otherwise exist.
 *
 *   ?t=0 | ?t=330 | ?t=5:30   start the game clock there
 *   &rate=60                  run 60x real time. &rate=0 freezes it
 *   &a=Dom,Dave &b=Sam,Tom    the two squads
 *   &g=7 &game=120 &rot=2     the three settings
 *   &seed=1                   a deterministic draw for the starting pitch
 *   &count=0                  skip the kick-off countdown
 *   &auto=1                   kick off as soon as the page loads
 */
const debug = (() => {
  const params = new URLSearchParams(location.search);
  if (!params.has('t')) return null;
  const raw = String(params.get('t') || '0').trim();
  let seconds = 0;
  if (raw.includes(':')) {
    const parts = raw.split(':');
    seconds = Number(parts[0]) * 60 + Number(parts[1] || 0);
  } else {
    seconds = Number(raw);
  }
  if (!Number.isFinite(seconds)) seconds = 0;
  /* `|| 1` swallowed a deliberate rate=0, which is the documented freeze */
  const asked = Number(params.get('rate'));
  const rate = params.has('rate') && Number.isFinite(asked) ? Math.max(0, asked) : 1;
  const list = (key) => {
    const value = params.get(key);
    if (value == null) return null;
    return String(value).split(',').map((name) => name.trim()).filter(Boolean);
  };
  const int = (key) => (params.has(key) ? Number(params.get(key)) : null);
  return {
    offsetMs: seconds * 1000,
    rate,
    realOrigin: Date.now(),
    origin: Date.now(),
    squads: [list('a'), list('b')],
    gameType: int('g'),
    gameMinutes: int('game'),
    rotations: int('rot'),
    seed: int('seed'),
    countdown: params.get('count') !== '0',
    auto: params.get('auto') === '1'
  };
})();

function nowMs() {
  if (!debug) return Date.now();
  return debug.origin + (Date.now() - debug.realOrigin) * debug.rate;
}

/*
 * TWO CLOCKS, AND THEY ARE NOT THE SAME CLOCK
 *
 * `elapsedMs` is the game: time since kick-off, less everything spent held.
 * It is what the watch shows and it is the only clock most of the app knows
 * about.
 *
 * `rotaMs` is the rota: the same clock, less whatever a mid-game retime moved.
 * Changing the interval has to leave the keeper standing where they are and
 * give them the share of the new shift they have not yet served, and there is
 * no way to say that in a clock which also has to keep counting the game. So
 * the rota carries its own offset and the watch never sees it.
 */
function elapsedMs() {
  const game = state.game;
  if (!game) return 0;
  /* held: the clock is read at the moment it stopped, so nothing moves */
  const at = game.pausedAt || nowMs();
  return Math.max(0, at - game.kickoff - (game.pausedMs || 0));
}

function rotaMs() {
  if (!state.game) return 0;
  return Math.max(0, elapsedMs() - (state.game.rotaShift || 0));
}

function isHeld() {
  return Boolean(state.game && state.game.pausedAt);
}

/* a deterministic draw, so a screenshot of the game screen is the same twice */
function randomFor() {
  if (!debug || !Number.isFinite(debug.seed)) return Math.random;
  let a = (debug.seed >>> 0) + 0x6D2B79F5;
  return function mulberry32() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- settings */

/*
 * The three settings and their grids. The wrap belongs to the engine, so this
 * asks the engine for it and only does the arithmetic itself if the export is
 * not there — which is the case exactly once, while the two files are being
 * written beside each other.
 */
const GRID = {
  aside: { min: 4, max: 11, step: 1, def: 6 },
  time: { min: 30, max: 150, step: 15, def: 120 },
  /* not a range. See ROTATION_STEPS in rotation.js for why the halves stop at
     three: above it a half step is worth less than a minute of shift. */
  rotations: { steps: [1, 1.5, 2, 2.5, 3, 4, 5], def: 2 }
};

const CYCLERS = {
  aside: ['cycleGameType', 'cycleAside', 'nextGameType'],
  time: ['cycleGameMinutes', 'cycleTime', 'nextGameMinutes'],
  rotations: ['cycleRotations', 'nextRotations']
};

function engineCycler(slot) {
  for (const name of CYCLERS[slot]) {
    if (typeof engine[name] === 'function') return engine[name];
  }
  return null;
}

function localCycle(slot, value) {
  const g = GRID[slot];
  if (g.steps) {
    const at = g.steps.indexOf(onGrid(slot, value));
    return g.steps[(at + 1) % g.steps.length];
  }
  const steps = Math.round((g.max - g.min) / g.step) + 1;
  const at = Math.round((onGrid(slot, value) - g.min) / g.step);
  return g.min + (((at + 1) % steps) + steps) % steps * g.step;
}

function cycle(slot, value) {
  const fn = engineCycler(slot);
  if (!fn) return localCycle(slot, value);
  const answer = Number(fn(value));
  /* an engine that returns nothing usable is not allowed to empty a setting */
  return Number.isFinite(answer) ? answer : localCycle(slot, value);
}

function onGrid(slot, value) {
  const g = GRID[slot];
  const n = Number(value);
  if (!Number.isFinite(n)) return g.def;
  if (g.steps) {
    return g.steps.reduce(
      (best, step) => (Math.abs(step - n) < Math.abs(best - n) ? step : best),
      g.steps[0]
    );
  }
  const at = Math.round((n - g.min) / g.step);
  return Math.min(g.max, Math.max(g.min, g.min + at * g.step));
}

/* --------------------------------------------------------------- state */

const draft = {
  gameType: GRID.aside.def,
  gameMinutes: GRID.time.def,
  rotations: GRID.rotations.def,
  /* [[{ name, fixedGoalie, late }], [...]] */
  players: [[], []]
};

const state = {
  screen: 'setup',          /* 'setup' | 'countdown' | 'game' */
  game: null,               /* { kickoff, setup } */
  pendingSetup: null,
  shownChange: null,
  windowFor: null,
  /* the change the countdown is running towards. The horn only sounds on a
     change this was armed for, so a phone that slept through four of them
     wakes up on the right one in silence. */
  armedFor: null,
  beatLeft: 0,
  countdownAt: 0,
  countdownLeft: 0,
  countText: '',
  watchText: '',
  labelText: '',
  counting: false,
  degradedVoice: false,
  degradedLock: false,
  sheet: null
};

const $ = (id) => document.getElementById(id);

const el = {
  body: document.body,
  setup: $('setup'),
  game: $('game'),
  again: $('again'),
  forms: [$('form-0'), $('form-1')],
  inputs: [$('input-0'), $('input-1')],
  enters: [$('enter-0'), $('enter-1')],
  squads: [...document.querySelectorAll('.squad')],
  cols: [[$('names-0a'), $('names-0b')], [$('names-1a'), $('names-1b')]],
  values: { aside: $('value-aside'), time: $('value-time'), rotations: $('value-rotations') },
  cells: [...document.querySelectorAll('.cell')],
  kick: $('kick'),
  kickNote: $('kick-note'),
  timer: $('timer'),
  gauge: $('gauge'),
  timerLabel: $('timer-label'),
  count: $('count'),
  watch: $('watch'),
  end: $('end'),
  test: $('test'),
  hold: $('hold'),
  heldBar: $('held'),
  heldNote: $('held-note'),
  gvalues: { aside: $('gvalue-aside'), time: $('gvalue-time'), rotations: $('gvalue-rotations') },
  ruler: $('ruler'),
  reels: [$('reel-goal'), $('reel-subs')],
  sheet: $('sheet'),
  scrim: $('scrim'),
  panel: $('panel'),
  sheetClose: $('sheet-close'),
  sheetTitle: $('sheet-title'),
  sheetOpts: $('sheet-opts'),
  faults: $('faults')
};

/* ================================================================ audio */

/*
 * THE BUZZER WAS SILENT AND THE VOICE WAS NOT
 *
 * On iOS the hardware ring/silent switch mutes Web Audio and does not mute
 * `speechSynthesis`, so a phone on silent says the names and swallows the
 * horn. The fix is `navigator.audioSession.type = 'playback'`, set inside the
 * gesture and before the context is built, because a context takes the session
 * that is current when it is created.
 *
 * `resume()` returns a promise and dropping it leaves a context stuck in
 * `suspended`, which makes no sound and reports no error — the failure that
 * looks exactly like a muted phone.
 */

let ac = null;
let gestured = false;

/* what the last gesture and the last horn did. No agent can hear any of this,
   so it is written down and the debug hook reads it back. */
const heard = {
  before: 'none',
  after: 'none',
  rate: 0,
  session: 'none',
  horn: 'none',
  voice: 'none'
};

function claimSession() {
  const session = navigator.audioSession;
  if (!session) {
    heard.session = 'none';
    return;
  }
  try {
    session.type = 'playback';
  } catch (error) { /* a refused assignment is reported, not repaired */ }
  heard.session = String(session.type || 'unknown');
}

function audio() {
  if (ac) return ac;
  if (!gestured) return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ac = new Ctor();
  } catch (error) {
    ac = null;
    return null;
  }
  heard.rate = ac.sampleRate || 0;
  heard.after = ac.state;
  ac.addEventListener('statechange', () => { heard.after = ac ? ac.state : 'none'; });
  return ac;
}

function markGesture() {
  gestured = true;
  /* the session first. a context inherits whatever session is current when it
     is built, so asking after it exists is asking too late. */
  claimSession();
  const ctx = audio();
  heard.before = ctx ? ctx.state : 'none';
  resumeAudio();
}

function resumeAudio() {
  if (!ac) return;
  heard.rate = ac.sampleRate || 0;
  heard.after = ac.state;
  if (ac.state === 'running') return;
  const settle = () => { heard.after = ac ? ac.state : 'none'; };
  try {
    const done = ac.resume();
    if (done && typeof done.then === 'function') done.then(settle, settle);
    else settle();
  } catch (error) {
    settle();
  }
}

/*
 * The horn. Two and a half seconds of stadium horn, at kick-off and at every
 * changeover. sound.js carries why it is not a whistle and not a klaxon.
 * Returns its length so the caller can put the voice after it, not under it.
 */
function horn() {
  const ctx = audio();
  if (!ctx) {
    heard.horn = 'no context';
    return HORN_MS;
  }
  resumeAudio();
  try {
    buildHorn(ctx, ctx.currentTime + 0.01, ctx.destination);
    heard.horn = 'scheduled';
  } catch (error) {
    heard.horn = 'failed';
  }
  return HORN_MS;
}

const CHIME_MS = 330;

function chime() {
  const ctx = audio();
  if (!ctx) return CHIME_MS;
  resumeAudio();
  return buildChime(ctx, ctx.currentTime + 0.01, ctx.destination);
}

function tick880() {
  const ctx = audio();
  if (!ctx) return;
  resumeAudio();
  buildTick(ctx, ctx.currentTime + 0.005, ctx.destination);
}

/* one a second through the last ten seconds of a shift */
function beep() {
  const ctx = audio();
  if (!ctx) return;
  resumeAudio();
  buildBeep(ctx, ctx.currentTime + 0.005, ctx.destination);
}

/* ================================================================ voice */

/*
 * `speechSynthesis.speaking` is worth nothing: measured in Chrome 151 it stays
 * true for ever on a queued utterance that never starts. Only `start` proves a
 * voice.
 *
 * WHY THIS RETRIES, AND WHY IT NO LONGER HOLDS A VOICE
 *
 * The announcement is spoken two and a half seconds after the horn, which is
 * seconds after any touch and, at a changeover, after no touch at all. That is
 * the shape iOS is worst at: the engine is unlocked for the session and still
 * answers `speak()` with silence, no error and no `start`.
 *
 * Two things fix it and both are here.
 *
 * A held `SpeechSynthesisVoice` goes stale. The list is rebuilt behind the
 * page — on `voiceschanged`, on a return from the background, on a locale
 * change — and an utterance carrying a voice object from the old list is
 * answered with silence. So the choice is kept as a name and resolved against
 * the live list at the moment of speaking, and never held.
 *
 * And no start inside seven hundred milliseconds is a wedged engine, not a
 * slow one. A wedged engine is cleared and asked again, twice, and the second
 * ask drops our voice entirely and takes whatever the engine wants to use —
 * because a voice that will not speak is worse than an American one.
 *
 * `cancel()` is the other half of the wedge, so it is called in exactly two
 * places: on an utterance that never started, and when an announcement is
 * being replaced by a newer one. Never speculatively, and never on an empty
 * queue.
 */

const VOICE_START_MS = 700;
const VOICE_TRIES = 3;

/* the same names said twice, with a gap wide enough to be a second chance and
   not an echo. Across a pitch the first pass is the one that is half heard. */
const VOICE_PASSES = 2;
const PASS_GAP_MS = 1600;

let announceToken = 0;
let voiceName = '';

/* en-GB and local first. An engine left to pick can land on a US voice
   halfway through a season. */
function pickVoice() {
  if (!haveVoice()) return;
  let voices = [];
  try {
    voices = speechSynthesis.getVoices() || [];
  } catch (error) {
    voices = [];
  }
  if (voices.length === 0) return;
  const english = voices.filter((voice) => /^en/i.test(voice.lang || ''));
  const pool = english.length > 0 ? english : voices;
  const rank = (voice) => {
    const lang = String(voice.lang || '');
    const region = /^en-GB/i.test(lang) ? 0 : /^en/i.test(lang) ? 1 : 2;
    return region * 10 + (voice.localService ? 0 : 1);
  };
  const best = pool
    .slice()
    .sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)))[0];
  voiceName = best ? String(best.name) : '';
}

/* resolved fresh, every single time. See the header. */
function voiceNow() {
  if (!voiceName) return null;
  try {
    return (speechSynthesis.getVoices() || []).find((v) => v.name === voiceName) || null;
  } catch (error) {
    return null;
  }
}

/** Roughly how long a line takes to say, at rate 0.95 with its full stops. */
function sayMs(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.min(5200, 800 + words * 360);
}

function haveVoice() {
  return 'speechSynthesis' in window;
}

/* Replacing an announcement, or leaving the game. The only two cancels that
   are about the queue rather than about a wedge. */
function stopVoice() {
  if (!haveVoice()) return;
  try { speechSynthesis.cancel(); } catch (error) { /* ignore */ }
}

/* an engine that took an utterance and never started it. Clearing it is the
   only thing that gets the next one out. */
function unwedge() {
  if (!haveVoice()) return;
  try {
    speechSynthesis.cancel();
    speechSynthesis.resume();
  } catch (error) { /* ignore */ }
}

function utteranceFor(text, plain) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = plain ? null : voiceNow();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-GB';
  }
  return utterance;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

/*
 * iOS will not speak later in the session unless it has spoken once inside a
 * gesture. This is that once, and it does not say the app's name: the unlock
 * used to speak `rota` at volume 0.02 and iOS ignored the volume, so Kick off
 * announced the app. It cannot be silence either — an empty utterance, a
 * whitespace one and a lone full stop all have no phonemes and are the shapes
 * that leave the queue stuck. It is `ok` at rate 10, about fifty
 * milliseconds, spent at the first touch anywhere on the page.
 *
 * It used to arm a cancel fifteen hundred milliseconds later, in case the
 * unlock itself wedged. That cancel was landing on an empty queue, which is
 * the wedge, so it is gone.
 */
let voiceUnlocked = false;
let voiceAsks = 0;

function unlockVoice() {
  if (!haveVoice()) {
    state.degradedVoice = true;
    return;
  }
  try {
    /* a paused engine is the commonest wedge and resume() costs nothing */
    speechSynthesis.resume();
    const utterance = utteranceFor('ok');
    utterance.volume = 0.02;
    utterance.rate = 10;
    utterance.onstart = () => {
      state.degradedVoice = false;
      heard.voice = 'unlocked';
    };
    speechSynthesis.speak(utterance);
    voiceUnlocked = true;
  } catch (error) {
    state.degradedVoice = true;
  }
}

function speak(text, onEnd) {
  voiceAsks += 1;
  let done = false;
  let timer = 0;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    if (onEnd) onEnd();
  };
  if (!haveVoice()) {
    state.degradedVoice = true;
    finish();
    return;
  }

  let tries = 0;
  const attempt = () => {
    if (done) return;
    tries += 1;
    try {
      if (speechSynthesis.paused) speechSynthesis.resume();
      /* the second and third asks drop our chosen voice and take the engine's
         own. A voice object is the commonest thing that answers with silence. */
      const utterance = utteranceFor(text, tries > 1);
      utterance.onstart = () => {
        window.clearTimeout(timer);
        state.degradedVoice = false;
        heard.voice = tries === 1 ? 'speaking' : `speaking (try ${tries})`;
        /* `end` is not reliable either, so the sequence also moves on at an
           estimate — a dead engine costs an announcement its timing and never
           its second line */
        timer = window.setTimeout(finish, sayMs(text));
      };
      utterance.onend = finish;
      utterance.onerror = (event) => {
        const reason = event && event.error;
        /* a cancel is our own doing, and the retry is already on its way */
        if (reason === 'canceled' || reason === 'interrupted') return;
        heard.voice = `error: ${reason}`;
        window.clearTimeout(timer);
        if (tries < VOICE_TRIES) {
          timer = window.setTimeout(attempt, 60);
          return;
        }
        state.degradedVoice = true;
        finish();
      };
      speechSynthesis.speak(utterance);
      timer = window.setTimeout(() => {
        if (done) return;
        if (tries < VOICE_TRIES) {
          unwedge();
          attempt();
          return;
        }
        state.degradedVoice = true;
        heard.voice = 'never started';
        finish();
      }, VOICE_START_MS);
    } catch (error) {
      if (tries < VOICE_TRIES) {
        timer = window.setTimeout(attempt, 60);
        return;
      }
      state.degradedVoice = true;
      finish();
    }
  };
  attempt();
}

function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/*
 * ONE TEMPLATE, THE STATE AND NOT THE TRANSITION
 *
 *   [chime] Goalkeepers, Sam and Kevin. Subs, Chris and Lee.
 *   [pause]
 *   [chime] Goalkeepers, Sam and Kevin. Subs, Chris and Lee.
 *
 * The same words the screen shows, in the same two blocks, so the two never
 * disagree. It says who is in goal and who is sitting down, never who is
 * leaving, because a state is true for the next ten minutes and a transition
 * is true for a second.
 *
 * It is said twice. A pitch is the worst listening room there is — wind, two
 * other games, and the phone in a bag ten yards away — and the first pass is
 * the one that tells everybody to listen. The gap between them is a second
 * and a half, which is long enough that the second pass is a second chance
 * rather than an echo.
 *
 * The name is spoken exactly as it was typed. The screen's uppercase is a
 * `text-transform` and never reaches the engine.
 */
function linesForNow(r) {
  const teams = r.teams || [];
  const keepers = teams.map((team) => team.keeper).filter(Boolean).map((p) => p.name);
  const subs = teams.reduce((all, team) => all.concat((team.subs || []).map((p) => p.name)), []);
  const lines = [];
  if (keepers.length > 0) lines.push(`${COPY.goalkeepers}, ${joinNames(keepers)}.`);
  if (subs.length > 0) lines.push(`${COPY.subs}, ${joinNames(subs)}.`);
  return lines;
}

function announce(lines, passes = VOICE_PASSES) {
  announceToken += 1;
  const token = announceToken;
  /* the one cancel per announcement: this one replaces whatever is queued */
  stopVoice();
  if (lines.length === 0) return;

  /* the whole announcement as a flat list of steps, so the repeat is data and
     not a second code path */
  const steps = [];
  for (let pass = 0; pass < Math.max(1, passes); pass += 1) {
    if (pass > 0) steps.push({ wait: PASS_GAP_MS });
    /* the chime is the throwaway first token a sleeping bluetooth speaker
       eats, and there is one at the head of every pass for the same reason */
    steps.push({ chime: true });
    lines.forEach((text) => steps.push({ say: text }));
  }

  let at = 0;
  const next = () => {
    if (token !== announceToken || at >= steps.length) return;
    const step = steps[at];
    at += 1;
    if (step.wait) {
      window.setTimeout(next, step.wait);
      return;
    }
    if (step.chime) {
      window.setTimeout(next, chime() + 70);
      return;
    }
    speak(step.say, next);
  };
  next();
}

/* ================================================================ setup */

/*
 * The draft, handed to the engine as it stands. The list is the order it was
 * typed in and that order decides nothing: `kickOff` draws the ring and writes
 * it back into the setup. The two flags travel on the player record, which is
 * the only way they may be set — a boolean flipped on a live setup re-indexes
 * the ring under its own anchor, so mid-game the engine's `setLate` and
 * `setFixedGoalie` are the doors, and before kick-off there is nothing to
 * corrupt because the setup is built fresh on every keystroke.
 */
function draftSetup() {
  return engine.createSetup({
    gameType: draft.gameType,
    gameMinutes: draft.gameMinutes,
    rotations: draft.rotations,
    teams: [0, 1].map((t) => ({
      name: TEAM_NAMES[t],
      players: draft.players[t].map((p) => ({
        name: p.name,
        fixedGoalie: Boolean(p.fixedGoalie),
        late: Boolean(p.late)
      }))
    }))
  });
}

function intervalText() {
  if (!ready()) return COPY.dash;
  try {
    return mmss(engine.computeIntervalMs(draftSetup()));
  } catch (error) {
    return COPY.dash;
  }
}

/** Two names a side is the floor. Below it there is no rota to run. */
function ready() {
  return draft.players.every((list) => list.length >= 2);
}

function timeWords(minutes) {
  const m = Math.round(minutes);
  if (m % 60 === 0) return m === 60 ? '1hr' : `${m / 60}hrs`;
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

function icon(id, cls) {
  return `<svg class="ic ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

function safe(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/*
 * Down the first column and then down the second, `ceil(n/2)` and the rest —
 * which is the 4/4 and the 4/3 the filled frame shows for eight names and for
 * seven.
 */
function renderNames(teamIndex) {
  const list = draft.players[teamIndex];
  const half = Math.ceil(list.length / 2);
  const parts = [list.slice(0, half), list.slice(half)];

  parts.forEach((column, c) => {
    el.cols[teamIndex][c].innerHTML = column.map((player) => {
      const i = list.indexOf(player);
      /*
       * One mark for both flags — a 23px block of ink with the glyph knocked
       * out of it — because both say the same thing about the rotation and
       * only then differ in which. The glove is the one the game screen marks
       * the next keeper with. The name itself is never dimmed.
       */
      const flag = player.fixedGoalie ? ['i-glove', COPY.fixedGoalie]
        : player.late ? ['i-watch', COPY.late]
        : null;
      const mark = flag
        ? `<span class="flag">${icon(flag[0], 'ic16')}` +
          `<span class="sr-only">${safe(flag[1])}</span></span>`
        : '';
      return (
        `<div class="nrow">` +
        `<button class="nm dsp" type="button" ` +
        `data-name="${i}" data-team="${teamIndex}">${safe(player.name)}</button>` +
        mark +
        `<button class="x" type="button" data-drop="${i}" data-team="${teamIndex}" ` +
        `aria-label="Remove ${safe(player.name)}">${icon('i-x', 'ic23')}</button>` +
        `</div>`
      );
    }).join('');
  });
}

function renderSetup() {
  const total = draft.players[0].length + draft.players[1].length;
  el.again.classList.toggle('gone', total === 0);

  for (let t = 0; t < 2; t += 1) {
    renderNames(t);
    el.enters[t].classList.toggle('ready', el.inputs[t].value.trim().length > 0);
  }

  el.values.aside.textContent = String(draft.gameType);
  el.values.time.textContent = timeWords(draft.gameMinutes);
  el.values.rotations.textContent = String(draft.rotations);

  el.kick.disabled = !ready();
  el.kickNote.textContent = `${COPY.rotateEvery} ${intervalText()}`;
  fitNames();
}

/* -------------------------------------------------------------- naming */

function addName(teamIndex, raw) {
  const name = String(raw).trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  if (!name) return false;
  const taken = draft.players[teamIndex]
    .some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (taken) return false;
  draft.players[teamIndex].push({ name, fixedGoalie: false, late: false });
  return true;
}

function commitField(teamIndex) {
  const input = el.inputs[teamIndex];
  const added = addName(teamIndex, input.value);
  input.value = '';
  renderSetup();
  if (added) saveSquad();
  input.focus();
}

el.inputs.forEach((input, t) => {
  input.addEventListener('input', () => {
    el.enters[t].classList.toggle('ready', input.value.trim().length > 0);
  });
});

/*
 * THE RETURN KEY COMMITS THE NAME
 *
 * It is a `submit` and not a `keydown`, because on iOS a bare input has no
 * return key to press — the keyboard shows `done`, which dismisses it and
 * never reaches the page. An input inside a form gets a real return, and
 * `enterkeyhint` is what puts the word on it.
 *
 * The arrow is the form's submit button, so both routes are one handler and
 * they cannot drift apart.
 */
el.forms.forEach((form, t) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    commitField(t);
  });
});

/*
 * One listener for both squads. A tap on a name opens its sheet, a tap on the
 * cross takes it out, and neither reaches for a node that a re-render has
 * already replaced.
 */
document.addEventListener('click', (event) => {
  const drop = event.target.closest('[data-drop]');
  if (drop) {
    const t = Number(drop.dataset.team);
    draft.players[t].splice(Number(drop.dataset.drop), 1);
    renderSetup();
    saveSquad();
    return;
  }
  const name = event.target.closest('[data-name]');
  if (name) openPlayerSheet(Number(name.dataset.team), Number(name.dataset.name));
});

/* ------------------------------------------------------------ settings */

el.cells.forEach((cell) => {
  cell.addEventListener('click', () => {
    const slot = cell.dataset.cell;
    if (slot === 'aside') draft.gameType = onGrid('aside', cycle('aside', draft.gameType));
    if (slot === 'time') draft.gameMinutes = onGrid('time', cycle('time', draft.gameMinutes));
    if (slot === 'rotations') draft.rotations = onGrid('rotations', cycle('rotations', draft.rotations));
    renderSetup();
    saveSquad();
  });
});

/* ------------------------------------------------------- start again */

/* both lists emptied and the remembered squad forgotten. It is the only thing
   on this screen that takes something away, and it can only run before a game. */
el.again.addEventListener('click', () => {
  draft.players = [[], []];
  if (!debug) dropKey(KEY_SQUAD);
  renderSetup();
  el.inputs[0].focus();
});

/* ================================================================ sheet */

/*
 * One black band for two jobs. It is opened with a title and a row of words,
 * each word its own control, and it closes on the cross, on the scrim, on
 * Escape and on anything that acts.
 *
 * `on` means the control is filled. A toggle sets it because it is on. The
 * confirm sets it on `END` because that is the answer the question is asking
 * for, and one filled control against one outlined one is the only way this
 * palette can say which of two buttons is the primary.
 */
/* `on` may be a value or a reading of one. A switch has to be able to change
   because the other switch changed, and re-rendering the row to say so throws
   away the travel that makes it a switch. */
function sheetOn(option) {
  return typeof option.on === 'function' ? Boolean(option.on()) : Boolean(option.on);
}

/* the state, onto the rows that are already on the screen */
function syncSheet() {
  if (!state.sheet) return;
  [...el.sheetOpts.children].forEach((button, i) => {
    const option = state.sheet[i];
    if (!option) return;
    const on = sheetOn(option);
    button.classList.toggle('on', on);
    if (option.toggle) button.setAttribute('aria-checked', String(on));
  });
}

function openSheet(title, options) {
  state.sheet = options;
  el.sheetTitle.textContent = title;
  el.sheetOpts.innerHTML = options.map((option, i) => (option.toggle
    /* a flag is a switch: the knob is somewhere, and somewhere has an other
       side, so the control says it has two states before a word is read */
    ? `<button class="tog${sheetOn(option) ? ' on' : ''}" type="button" data-opt="${i}" ` +
      `role="switch" aria-checked="${String(sheetOn(option))}">` +
      `<span class="tog-word dsp">${safe(option.label)}</span>` +
      `<span class="sw" aria-hidden="true"><span class="knob"></span></span>` +
      `</button>`
    /* an answer is not a state. Two words, and the filled one is the primary */
    : `<button class="opt${sheetOn(option) ? ' on' : ''}" type="button" data-opt="${i}">` +
      `<span class="dsp">${safe(option.label)}</span></button>`
  )).join('');
  el.sheet.hidden = false;
  /* the band is in the middle of the screen and nothing else on it is live, so
     the reading order starts inside it. `preventScroll` because iOS will jump
     the page to a thing it has just focused. */
  try { el.panel.focus({ preventScroll: true }); } catch (error) { el.panel.focus(); }
}

function closeSheet() {
  state.sheet = null;
  el.sheet.hidden = true;
}

el.sheetOpts.addEventListener('click', (event) => {
  const button = event.target.closest('[data-opt]');
  if (!button || !state.sheet) return;
  const option = state.sheet[Number(button.dataset.opt)];
  if (option && option.act) option.act();
});

el.sheetClose.addEventListener('click', closeSheet);
el.scrim.addEventListener('click', closeSheet);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el.sheet.hidden) closeSheet();
});

/*
 * A NAME CARRIES TWO FLAGS
 *
 *   KEVIN                          x
 *   ─────────────────────────────────
 *   Fixed goalie              [ ●   ]
 *   Late                      [   ● ]
 *
 * The name at reading size over two switched rows, on a panel inset from both
 * edges. The word used to be the control — filled on, outlined off — and a
 * filled word beside an outlined word reads as a chosen one beside an unchosen
 * one, with nothing in either shape to say that tapping it flips it.
 *
 * A switch says it before a word is read. The colour rule is the app's own and
 * is unchanged: inverted against the ground means on, so the track fills white
 * and the knob goes black. What the switch adds is somewhere for the knob to
 * be, which is what makes the other side visible while you are looking at this
 * one.
 *
 * The whole row is the target and the state is written onto the row that is
 * already on the screen — turning one flag on turns the other off, and a
 * re-render would make that a jump instead of a switch moving.
 */
function openPlayerSheet(teamIndex, index) {
  const player = draft.players[teamIndex][index];
  if (!player) return;
  const refresh = () => {
    renderSetup();
    saveSquad();
    syncSheet();
  };
  openSheet(player.name, [
    {
      label: COPY.fixedGoalie,
      on: () => Boolean(player.fixedGoalie),
      toggle: true,
      act() {
        const turningOn = !player.fixedGoalie;
        /* one pair of gloves a team. Turning one on takes the other off. */
        if (turningOn) draft.players[teamIndex].forEach((p) => { p.fixedGoalie = false; });
        player.fixedGoalie = turningOn;
        /* a fixed goalie is never on the bench, so being late means nothing */
        if (turningOn) player.late = false;
        refresh();
      }
    },
    {
      label: COPY.late,
      on: () => Boolean(player.late),
      toggle: true,
      act() {
        player.late = !player.late;
        if (player.late) player.fixedGoalie = false;
        refresh();
      }
    }
  ]);
}

/* ================================================================= game */

function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function elapsedWords(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/*
 * THE REEL
 *
 * Two of them, one a role: both keepers on the first and both benches on the
 * second. Each is the whole game on one line — every change from the first to
 * the last, in order, with the one in play in the middle at 50px and the rest
 * either side of it at 24px and half ink. The screen shows about two along in
 * each direction and the edge of the phone ends it.
 *
 * There is no arithmetic here and there is no new engine call to write. The
 * rotation is a pure function of elapsed time, so the pitch at change `k` is
 * `rotation(setup, k * intervalMs)`; landing exactly on a boundary floors to
 * that change, which is why the multiplication is safe.
 *
 * WHY IT IS BUILT ONCE
 *
 * The rota does not change while a game runs, so the reel is the same list of
 * names for two hours. It is written at kick-off and after that a change moves
 * one class and the line slides. Rebuilding it every seven minutes would throw
 * away the thing that makes a slide read as a slide: the same elements, in the
 * same order, in a new place.
 */

/*
 * The reel has no end. `changeIndex` counts past the final whistle and never
 * stops, so a game that runs over carries on rotating and the line has to have
 * somewhere to go. It is grown from the right instead of rebuilt, which leaves
 * every element already on it exactly where it was — the thing that makes a
 * slide read as a slide rather than as a repaint.
 *
 * Six ahead is about three more than the screen can show.
 */
const REEL_AHEAD = 6;

/* the middle is a fixed column, whatever is standing in it */
const NOW_W = 188;
const HERO = 50;
const REST = 24;
/*
 * Below this a name is a shape and not a word, and a block with this little
 * room in it has a bigger problem than type size. 24 was the floor until the
 * settings row started taking a third of the screen while the game is held.
 */
const FIT_FLOOR = 15;
/* the gap between the mark and the names, and it is in the stylesheet too */
const MARK_GAP = 12;
/* long enough to read as one thing moving and short enough to be over before
   anybody looks up. It matches the transition in the stylesheet. */
const GLIDE_MS = 420;

const reels = [
  { node: el.reels[0], groups: [], at: 0, x: 0 },
  { node: el.reels[1], groups: [], at: 0, x: 0 }
];

/* the setup the reels were built from. Identity, not equality: `kickOff`
   returns a new object and that is exactly when the reel has to be rebuilt. */
let reelSetup = null;
/* while this is in the future the reels are re-centred every frame, which is
   what keeps the middle in the middle while the two sizes are still changing */
let glideUntil = 0;

function groupMarkup(names) {
  return `<div class="grp">${(names.length > 0 ? names : [COPY.dash])
    .map((name) => `<p class="rn dsp">${safe(name)}</p>`)
    .join('')}</div>`;
}

function emptyReels() {
  reels.forEach((reel) => {
    reel.node.innerHTML = '';
    reel.node.style.transform = '';
    reel.groups = [];
    reel.at = 0;
    reel.x = 0;
  });
}

/* Both reels to the same length, appending only. There is no arithmetic here:
   the pitch at change `k` is `rotation(setup, k * intervalMs)`, and landing
   exactly on a boundary floors to that change. */
function growReels(setup, upto) {
  const from = reels[0].groups.length;
  if (upto < from) return;
  const intervalMs = engine.computeIntervalMs(setup);
  const parts = [[], []];
  for (let k = from; k <= upto; k += 1) {
    const teams = engine.rotation(setup, k * intervalMs).teams || [];
    parts[0].push(teams.map((team) => team.keeper).filter(Boolean).map((p) => p.name));
    parts[1].push(teams.reduce((all, team) => all.concat((team.subs || []).map((p) => p.name)), []));
  }
  reels.forEach((reel, i) => {
    reel.node.insertAdjacentHTML('beforeend', parts[i].map(groupMarkup).join(''));
    reel.groups = [...reel.node.children];
  });
}

/*
 * A NAME THAT DOES NOT FIT IS SET SMALLER, NOT CUT OFF
 *
 * Two things can be too small for a group in the middle: the 188px column,
 * which a ten letter name overruns at 50px, and the height left between the
 * mark and the bottom of the block, which four names overrun on any phone.
 * Both are answered the same way and the smaller answer wins.
 *
 * The measuring is done on a ruler off the side of the page and never on the
 * live element, because the live element is in the middle of a transition and
 * writing a size to it to read one back is a flash on the screen.
 */
function widthAt(name) {
  el.ruler.textContent = name;
  return el.ruler.getBoundingClientRect().width;
}

function fitGroup(reel) {
  const group = reel.groups[reel.at];
  if (!group) return;
  const lines = [...group.children];
  if (lines.length === 0) return;

  let widest = 0;
  lines.forEach((line) => { widest = Math.max(widest, widthAt(line.textContent)); });

  /* the stack is `n` margin boxes of 0.7em with `n - 1` gaps of 0.3em between
     them, which is `n - 0.3` ems whatever `n` is */
  const body = reel.node.closest('.role-body');
  const mark = body ? body.querySelector('.role-mark') : null;
  const room = body ? body.clientHeight - (mark ? mark.getBoundingClientRect().height : 0) - MARK_GAP : 0;

  const byWidth = widest > 0 ? HERO * (NOW_W / widest) : HERO;
  const byHeight = room > 0 ? room / (lines.length - 0.3) : HERO;
  const size = Math.max(FIT_FLOOR, Math.min(HERO, byWidth, byHeight));
  group.style.fontSize = `${size.toFixed(1)}px`;
  /*
   * The rest of the reel never stands taller than the middle of it. Held, the
   * settings row takes a third of the screen and a four-name stack can be
   * fitted below 24 — and a queue set larger than the answer it is queueing
   * behind is the wrong way round whatever the room.
   */
  reel.node.style.setProperty('--rest', `${Math.min(REST, size).toFixed(1)}px`);
}

/*
 * The middle of the active group put on the middle of the reel. It is measured
 * and corrected rather than calculated, so it is right while the two sizes are
 * still animating and it needs no arithmetic about gaps.
 */
function centreReel(reel) {
  const group = reel.groups[reel.at];
  if (!group) return;
  const frame = reel.node.parentNode.getBoundingClientRect();
  const now = group.getBoundingClientRect();
  if (!frame.width || !now.width) return;
  const drift = (frame.left + frame.width / 2) - (now.left + now.width / 2);
  if (Math.abs(drift) < 0.05) return;
  reel.x += drift;
  reel.node.style.transform = `translateX(${reel.x.toFixed(2)}px)`;
}

function centreReels() {
  reels.forEach(centreReel);
}

/* the last word on where the reel stops. The per-frame centring runs on a
   deadline, and a throttled tab can finish the transition after it — so the
   transition itself gets the final say and the middle cannot end up off
   centre for the next seven minutes. */
reels.forEach((reel) => {
  reel.node.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'font-size') centreReel(reel);
  });
});

function setNow(reel, index, jump) {
  const at = Math.max(0, Math.min(reel.groups.length - 1, index));
  reel.groups.forEach((group, i) => {
    /* only the middle is ever fitted, so every other one goes back to 24 */
    if (i !== at) group.style.fontSize = '';
    group.className = i === at ? 'grp now' : 'grp';
  });
  reel.at = at;
  fitGroup(reel);
  if (!jump) return;
  /* a jump is a kick-off, a restore or a phone that woke up four changes late.
     None of them is a rotation, so none of them slides. */
  reel.node.classList.add('jump');
  centreReel(reel);
  /* the read that makes the suppressed transition real before it is lifted */
  reel.node.getBoundingClientRect();
  reel.node.classList.remove('jump');
}

function paint(r, setup, jump) {
  if (setup !== reelSetup) {
    reelSetup = setup;
    emptyReels();
    jump = true;
  }
  growReels(setup, r.changeIndex + REEL_AHEAD);
  reels.forEach((reel) => setNow(reel, r.changeIndex, jump));
  if (jump) {
    glideUntil = 0;
    centreReels();
  } else {
    glideUntil = Date.now() + GLIDE_MS + 120;
  }
}

/* the setup screen's own names, which have a column to fit into and no reel */
function fitLine(node) {
  node.style.fontSize = '';
  if (!node.textContent) return;
  const box = node.getBoundingClientRect().width;
  if (!box) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  const wide = range.getBoundingClientRect().width;
  if (wide <= box) return;
  const size = parseFloat(getComputedStyle(node).fontSize);
  node.style.fontSize = `${Math.max(FIT_FLOOR, Math.floor(size * box / wide))}px`;
}

function fitNames() {
  document.querySelectorAll('.nm').forEach(fitLine);
}

window.addEventListener('resize', () => {
  fitNames();
  reels.forEach(fitGroup);
  centreReels();
});

/* a webfont that lands after the first paint changes every width on the page */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    fitNames();
    reels.forEach(fitGroup);
    centreReels();
  }).catch(() => { /* a fallback face is still a measurable one */ });
}

function setCount(text) {
  if (text === state.countText) return;
  state.countText = text;
  el.count.textContent = text;
}

function setLabel(text) {
  if (text === state.labelText) return;
  state.labelText = text;
  el.timerLabel.textContent = text;
}

function setCounting(on) {
  if (on === state.counting) return;
  state.counting = on;
  el.game.classList.toggle('counting', on);
}

function setGauge(fraction) {
  el.gauge.style.setProperty('--shift', String(Math.min(1, Math.max(0, fraction))));
}

/* ================================================================== tick */

let rafId = 0;
let intervalId = 0;

function tick() {
  if (state.screen === 'countdown') {
    runCountdown();
    return;
  }
  if (state.screen !== 'game' || !state.game) return;

  const elapsed = elapsedMs();
  const r = engine.rotation(state.game.setup, rotaMs());
  const held = isHeld();
  /* a held clock is never in the last ten seconds of anything */
  const inWindow = !held && r.msToNextChange <= WINDOW_MS;

  /* the crossing, not the tick */
  if (r.changeIndex !== state.shownChange) {
    /* the countdown ran towards this change, so this is a real changeover and
       not a phone waking up past one */
    const armed = state.armedFor === r.changeIndex;
    /* one step forward from a change we were already showing is a rotation and
       it slides. A first paint, a jump backwards, or four changes at once is a
       phone catching up, and that lands rather than travels. */
    const stepped = state.shownChange !== null && r.changeIndex === state.shownChange + 1;
    state.shownChange = r.changeIndex;
    state.windowFor = null;
    state.armedFor = null;
    state.beatLeft = 0;
    /* a change slides the reels; a phone waking up past four of them does not,
       and neither does a kick-off */
    paint(r, state.game.setup, !stepped);

    /* THE HORN LANDS ON THE CHANGE. It used to land ten seconds early and be
       the warning itself. The countdown is the warning now, so the horn is
       what the countdown arrives at — and the names follow it, describing the
       pitch as it now stands. The same order as kick-off. */
    if (armed) {
      const wait = horn();
      window.setTimeout(() => announce(linesForNow(r)), wait + VOICE_GAP_MS);
    }
  }

  if (inWindow && state.windowFor !== r.changeIndex + 1) {
    state.windowFor = r.changeIndex + 1;
    /* a window walked in on late — a jump, or a phone that woke up in it — is
       not a countdown. Nothing is armed, so nothing counts and nothing sounds
       at the change. Everything else is a real ten seconds. */
    if (r.msToNextChange >= WINDOW_MS - 900) {
      state.armedFor = r.changeIndex + 1;
      state.beatLeft = 0;
    }
  }

  const left = Math.max(1, Math.ceil(r.msToNextChange / 1000));

  /* one beep a second, on the second the screen changes to, so the sound and
     the number are never a frame apart */
  if (inWindow && state.armedFor === r.changeIndex + 1 && left !== state.beatLeft) {
    state.beatLeft = left;
    beep();
  }

  setCounting(inWindow);
  setLabel(held ? COPY.paused : COPY.nextRotation);
  /* in the window the bar measures the window, not the shift */
  setGauge(inWindow
    ? r.msToNextChange / WINDOW_MS
    : r.msToNextChange / r.intervalMs);
  setCount(inWindow ? String(left) : mmss(r.msToNextChange));

  const watch = elapsedWords(elapsed);
  if (watch !== state.watchText) {
    state.watchText = watch;
    el.watch.textContent = watch;
  }

  /* the middle stays in the middle while the two sizes are still changing.
     Measured every frame, and only while a slide is in flight. */
  if (Date.now() < glideUntil) centreReels();

  setFaults();
}

function loop() {
  tick();
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  if (!rafId) rafId = requestAnimationFrame(loop);
  if (!intervalId) intervalId = window.setInterval(tick, 250);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  if (intervalId) window.clearInterval(intervalId);
  rafId = 0;
  intervalId = 0;
}

/* the clock is `Date.now() - kickoff` and nothing else, so a phone that slept
   through four changes comes back on the right one */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  resumeAudio();
  tick();
  takeWakeLock();
});

function setFaults() {
  const faults = [];
  if (state.degradedVoice) faults.push('No voice');
  if (state.degradedLock) faults.push('Screen may sleep');
  const said = faults.join('. ');
  if (el.faults.textContent !== said) el.faults.textContent = said;
}

/* ============================================================= kick off */

function showSetup() {
  state.screen = 'setup';
  el.setup.hidden = false;
  el.game.hidden = true;
  setCounting(false);
  renderSetup();
}

function showGame() {
  el.setup.hidden = true;
  el.game.hidden = false;
  takeWakeLock();
}

function saveSquad() {
  if (debug) return;
  writeJSON(KEY_SQUAD, {
    gameType: draft.gameType,
    gameMinutes: draft.gameMinutes,
    rotations: draft.rotations,
    players: draft.players
  });
}

el.kick.addEventListener('click', () => {
  if (!ready()) return;
  /* the gesture iOS needs for the audio context. The voice was unlocked at the
     first touch of the session, and a second one here would be a word spoken
     over the kick-off. */
  markGesture();
  if (!voiceUnlocked) unlockVoice();
  saveSquad();
  beginKickOff();
});

function beginKickOff() {
  const setup = engine.kickOff(draftSetup(), randomFor());
  state.pendingSetup = setup;

  const r = engine.rotation(setup, 0);
  showGame();
  el.game.classList.add('first');
  paint(r, setup, true);
  el.watch.textContent = '0:00';
  state.watchText = '0:00';

  if (debug && !debug.countdown) {
    finishKickOff();
    return;
  }

  state.screen = 'countdown';
  state.countdownAt = Date.now();
  state.countdownLeft = KICKOFF_S + 1;
  setCounting(true);
  setLabel(COPY.kickOffIn);
  setGauge(1);
  takeWakeLock();
  startLoop();
  runCountdown();
}

function runCountdown() {
  const gone = Date.now() - state.countdownAt;
  const left = KICKOFF_S - Math.floor(gone / 1000);
  if (left <= 0) {
    finishKickOff();
    return;
  }
  if (left === state.countdownLeft) return;
  state.countdownLeft = left;
  setCount(String(left));
  if (left <= 5) tick880();
}

function finishKickOff() {
  const setup = state.pendingSetup;
  state.pendingSetup = null;
  state.game = {
    kickoff: nowMs() - (debug ? debug.offsetMs : 0),
    setup,
    /* held time, and the rota's own offset. Both are part of the game and both
       have to survive the phone dying. */
    pausedMs: 0,
    pausedAt: 0,
    rotaShift: 0
  };
  state.screen = 'game';
  state.shownChange = null;
  state.windowFor = null;
  state.armedFor = null;
  state.beatLeft = 0;
  state.countText = '';
  setCounting(false);
  el.game.classList.remove('first');
  applyHeld();
  showGame();
  saveGame();

  const wait = horn();
  const r = engine.rotation(setup, rotaMs());
  /* the same order as a changeover: the horn finishes, then the names */
  window.setTimeout(() => announce(linesForNow(r)), wait + VOICE_GAP_MS);

  startLoop();
  tick();
}

/*
 * THE SOUND TEST
 *
 * The one thing this app does that fails silently. A phone on silent swallows
 * the horn and still says the names; a phone with the media volume down does
 * neither; and both of those look exactly like an app that is working right up
 * until the first changeover, when nobody hears it.
 *
 * So the test plays both channels, because on iOS they are two different
 * channels and they fail independently: the horn is Web Audio, which the ring
 * switch mutes, and the voice is `speechSynthesis`, which it does not. One of
 * them sounding and the other not is the answer, not a failure of the test.
 */
el.test.addEventListener('click', (event) => {
  event.stopPropagation();
  markGesture();
  if (!voiceUnlocked) unlockVoice();
  const wait = horn();
  window.setTimeout(() => announce([COPY.soundTest], 1), wait + VOICE_GAP_MS);
});

/* ================================================================= held */

/*
 * A WAY TO STOP THE CLOCK, AND THE ONLY WAY TO EDIT
 *
 * The rule this breaks said the game screen carries two controls and neither
 * touches the rota. It carries three now, and the third one is the answer to
 * the two things that actually go wrong on a pitch: somebody has to
 * reorganise, and the interval turns out to be wrong once you are playing.
 *
 * Both are the same moment, so they are the same control. Held, the block
 * loses its colour, the clock stops where it is, and the three settings appear
 * under it. Running, they are gone and there is nothing to operate.
 *
 * Held time is not game time: `pausedMs` comes off the clock, so a game held
 * for six minutes is still forty minutes old when it starts again, and a phone
 * that dies while held comes back held.
 */

const HELD_KEYS = { aside: 'gameType', time: 'gameMinutes', rotations: 'rotations' };

function applyHeld() {
  const on = isHeld();
  el.game.classList.toggle('held-on', on);
  el.heldBar.hidden = !on;
  el.hold.setAttribute('aria-label', on ? 'Resume the game' : 'Pause the game');
  if (on) renderHeld();
  /* the settings row takes a third of the screen and gives it straight back,
     so the reels are re-fitted here and not left to the next change — which on
     a held clock is never */
  reels.forEach(fitGroup);
  centreReels();
}

function renderHeld() {
  if (!state.game) return;
  const setup = state.game.setup;
  el.gvalues.aside.textContent = String(engine.gameTypeOf(setup));
  el.gvalues.time.textContent = timeWords(engine.gameMinutesOf(setup));
  el.gvalues.rotations.textContent = String(engine.rotationsOf(setup));
  el.heldNote.textContent = `${COPY.rotateEvery} ${mmss(engine.computeIntervalMs(setup))}`;
}

el.hold.addEventListener('click', (event) => {
  event.stopPropagation();
  if (state.screen !== 'game' || !state.game) return;
  if (isHeld()) {
    state.game.pausedMs = (state.game.pausedMs || 0) + (nowMs() - state.game.pausedAt);
    state.game.pausedAt = 0;
  } else {
    state.game.pausedAt = nowMs();
    /* an announcement half said into a huddle is worse than none */
    announceToken += 1;
    stopVoice();
  }
  /* a countdown armed before the hold is a countdown to a change that is now
     minutes away. It is disarmed either way and the next real window arms the
     next one. */
  state.windowFor = null;
  state.armedFor = null;
  state.beatLeft = 0;
  applyHeld();
  saveGame();
  tick();
});

/*
 * A tap applies straight away, and the retime is where the two clocks part.
 *
 * `engine.retime` keeps the ring, the keeper and the bench and moves only the
 * length of a shift. What it cannot know is how much of the current shift has
 * been served, so that is carried here: a keeper who has just gone in gets the
 * whole of the new shift, one who is nearly done gets what is left of it, and
 * the offset between the two clocks absorbs the difference. Anything simpler
 * either cuts a turn short or hands somebody a double one.
 */
el.heldBar.addEventListener('click', (event) => {
  const cell = event.target.closest('[data-gcell]');
  if (!cell || !isHeld() || !state.game) return;
  const slot = cell.dataset.gcell;
  const setup = state.game.setup;
  const now = {
    aside: engine.gameTypeOf(setup),
    time: engine.gameMinutesOf(setup),
    rotations: engine.rotationsOf(setup)
  }[slot];

  const before = rotaMs();
  const was = engine.computeIntervalMs(setup);
  const next = engine.retime(setup, before, { [HELD_KEYS[slot]]: onGrid(slot, cycle(slot, now)) });
  const is = engine.computeIntervalMs(next);
  const served = was > 0 ? (before % was) / was : 0;
  const want = (Math.floor(before / is) + served) * is;

  state.game.rotaShift = (state.game.rotaShift || 0) + (before - want);
  state.game.setup = next;
  renderHeld();
  saveGame();
  tick();
});

/* =========================================================== going home */

/*
 * The way out of a game and into a new one. It is the only control in the app
 * that undoes something, so it is the only one that asks a question first —
 * and the clock does not stop while the question is on the screen.
 */
el.end.addEventListener('click', (event) => {
  event.stopPropagation();
  if (state.screen === 'countdown') {
    abortKickOff();
    return;
  }
  if (!state.game) return;
  openSheet(COPY.endTitle, [
    { label: COPY.endYes, on: true, act: goHome },
    { label: COPY.endNo, on: false, act: closeSheet }
  ]);
});

function abortKickOff() {
  if (state.screen !== 'countdown') return;
  state.pendingSetup = null;
  state.countText = '';
  el.game.classList.remove('first');
  stopLoop();
  showSetup();
}

function goHome() {
  closeSheet();
  stopLoop();
  announceToken += 1;
  stopVoice();

  /* the game goes first, so the lock's own release handler does not read the
     let-go as a screen that failed to stay awake */
  state.game = null;
  applyHeld();
  releaseWakeLock();
  state.shownChange = null;
  state.windowFor = null;
  state.armedFor = null;
  state.beatLeft = 0;
  state.degradedLock = false;
  state.countText = '';
  state.watchText = '';
  dropKey(KEY_GAME);

  /* the team select comes back the way a cold boot leaves it: last week's
     squad, ready to be a new game */
  loadSquad(debug ? null : readJSON(KEY_SQUAD));
  showSetup();
}

/*
 * Any first touch, anywhere, is enough to bring a restored game back to life.
 * Every later touch is a free second chance for a context that never reached
 * `running` — a call or a lock screen leaves one `interrupted`, and an
 * interrupted context is silent about being silent.
 */
document.addEventListener('pointerdown', () => {
  const first = !gestured;
  if (first || (ac && ac.state !== 'running')) markGesture();
  if (!voiceUnlocked) unlockVoice();
  else if (first && state.game && state.degradedVoice) unlockVoice();
  /* a paused engine is silent and says nothing about being paused. Every touch
     is a free chance to lift it, and resume() on a running engine is a no-op. */
  else if (haveVoice()) { try { speechSynthesis.resume(); } catch (error) { /* ignore */ } }
}, { capture: true });

/* ======================================================== staying alive */

let wakeLock = null;

function takeWakeLock() {
  if (state.screen === 'setup' && !state.game) return;
  if (!('wakeLock' in navigator)) {
    state.degradedLock = true;
    return;
  }
  if (wakeLock) return;
  navigator.wakeLock.request('screen').then((lock) => {
    wakeLock = lock;
    state.degradedLock = false;
    lock.addEventListener('release', () => {
      wakeLock = null;
      if (state.game) state.degradedLock = true;
    });
  }).catch(() => {
    state.degradedLock = true;
  });
}

function releaseWakeLock() {
  if (!wakeLock) return;
  const lock = wakeLock;
  wakeLock = null;
  try { lock.release(); } catch (error) { /* ignore */ }
}

/* ========================================================= persistence */

function saveGame() {
  if (debug || !state.game) return;
  writeJSON(KEY_GAME, state.game);
}

function loadSquad(squad) {
  if (!squad) return;
  const stored = Array.isArray(squad.players) ? squad.players : null;
  if (stored) {
    draft.players = [0, 1].map((t) => (Array.isArray(stored[t]) ? stored[t] : [])
      .map((p) => ({
        name: String(p && p.name ? p.name : p).slice(0, NAME_MAX),
        fixedGoalie: Boolean(p && p.fixedGoalie),
        late: Boolean(p && p.late)
      }))
      .filter((p) => p.name.length > 0));
  }
  if (Number.isFinite(squad.gameType)) draft.gameType = onGrid('aside', squad.gameType);
  if (Number.isFinite(squad.gameMinutes)) draft.gameMinutes = onGrid('time', squad.gameMinutes);
  if (Number.isFinite(squad.rotations)) draft.rotations = onGrid('rotations', squad.rotations);
}

function restoreGame() {
  const game = readJSON(KEY_GAME);
  if (!game || !Number.isFinite(game.kickoff) || !game.setup) return false;
  /* the same sum `elapsedMs` does, before there is a `state.game` to ask */
  const at = Number(game.pausedAt) || Date.now();
  const elapsed = at - game.kickoff - (Number(game.pausedMs) || 0);
  const minutes = Number(game.setup.gameMinutes) || GRID.time.def;
  const limit = (minutes + 60) * MS_PER_MINUTE;
  if (elapsed < 0 || elapsed > limit) {
    dropKey(KEY_GAME);
    return false;
  }

  state.game = {
    kickoff: game.kickoff,
    setup: game.setup,
    pausedMs: Number(game.pausedMs) || 0,
    pausedAt: Number(game.pausedAt) || 0,
    rotaShift: Number(game.rotaShift) || 0
  };
  if (debug) state.game.kickoff = nowMs() - debug.offsetMs;
  state.screen = 'game';

  const r = engine.rotation(state.game.setup, rotaMs());
  /* no dialog, and no voice for changes missed while the phone was dead */
  state.shownChange = r.changeIndex;
  /* a restore inside the window is a window that was never counted, so it is
     marked seen and left unarmed: no beeps, and no horn at the change it is
     already most of the way through */
  if (r.msToNextChange <= WINDOW_MS) state.windowFor = r.changeIndex + 1;
  state.armedFor = null;
  state.beatLeft = 0;
  showGame();
  paint(r, state.game.setup, true);
  startLoop();
  tick();
  return true;
}

/* ============================================================== debug */

if (debug) {
  window.rota = {
    state,
    draft,
    engine,
    heard,
    rotation: engine.rotation,
    view: () => (state.game ? engine.rotation(state.game.setup, rotaMs()) : null),
    getElapsed: () => elapsedMs(),
    setElapsed(ms) {
      if (!state.game) return 0;
      const at = state.game.pausedAt || nowMs();
      state.game.kickoff = at - (state.game.pausedMs || 0) - Math.max(0, Number(ms) || 0);
      tick();
      return elapsedMs();
    },
    hold: () => el.hold.click(),
    rotaMs,
    rate(n) {
      debug.origin = nowMs();
      debug.realOrigin = Date.now();
      debug.rate = Math.max(0, Number(n) || 0);
      return debug.rate;
    },
    kickOff: () => el.kick.click(),
    sheet: (t, i) => openPlayerSheet(t, i),
    reels,
    fit: () => reels.forEach(fitGroup),
    tick
  };
}

/* =============================================================== boot */

function boot() {
  if (debug) {
    if (Number.isFinite(debug.gameType)) draft.gameType = onGrid('aside', debug.gameType);
    if (Number.isFinite(debug.gameMinutes)) draft.gameMinutes = onGrid('time', debug.gameMinutes);
    if (Number.isFinite(debug.rotations)) draft.rotations = onGrid('rotations', debug.rotations);
    for (let t = 0; t < 2; t += 1) {
      if (!debug.squads[t]) continue;
      draft.players[t] = debug.squads[t].slice(0, 24)
        .map((name) => ({ name: name.slice(0, NAME_MAX), fixedGoalie: false, late: false }));
    }
  } else {
    loadSquad(readJSON(KEY_SQUAD));
  }

  renderSetup();
  if (!restoreGame()) showSetup();
  el.body.classList.remove('boot');

  if (debug && debug.auto && !state.game) {
    window.setTimeout(() => el.kick.click(), 0);
  }
}

boot();

/* ------------------------------------------------------------ offline */

/*
 * A NEW BUILD HAS TO LAND ON THE VISIT THAT FETCHES IT
 *
 * The worker serves from the cache and refreshes behind it, so a new build is
 * downloaded on one visit and shown on the next. On a phone that opens this
 * once a week that is a week late, and it looks exactly like a deploy that did
 * not happen.
 *
 * So the page reloads itself the moment a new worker takes over. Twice
 * guarded: not on the first install, when there was nothing to replace, and
 * never while a game is running — a reload mid-game would restore cleanly and
 * still be the last thing anybody wants on a touchline.
 */
if ('serviceWorker' in navigator && !debug) {
  const replacing = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!replacing || reloading || state.game) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* no service worker is still a working page, just not an offline one */
    });
  });
}
