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
import { buildHorn, buildChime, buildTick, HORN_MS } from './sound.js';

const MS_PER_MINUTE = 60000;
const NAME_MAX = 10;

/* the last ten seconds of every shift: the warning, and the grey */
const WINDOW_MS = 10000;
/* and the twenty before the first one */
const KICKOFF_S = 20;

/* the silence between the horn ending and the first chime */
const VOICE_GAP_MS = 150;

const TEAM_NAMES = ['Bibs', 'Non bibs'];

const COPY = {
  goal: 'Goal',
  sub: 'Sub',
  subs: 'Subs',
  nextRotation: 'Next rotation:',
  kickOffIn: 'Kick off in:',
  rotateEvery: 'Rotate every:',
  dash: '—',
  fixedGoalie: 'Fixed goalie',
  late: 'Late',
  endTitle: 'End the game?',
  endYes: 'End',
  endNo: 'Keep playing'
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

function elapsedMs() {
  if (!state.game) return 0;
  return Math.max(0, nowMs() - state.game.kickoff);
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
  rotations: { min: 1, max: 5, step: 1, def: 2 }
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
  keepers: [$('keeper-0'), $('keeper-1')],
  subs: [$('subs-0'), $('subs-1')],
  subSlots: [$('subslot-0'), $('subslot-1')],
  subLabels: [$('subs-label-0'), $('subs-label-1')],
  orders: [$('order-0'), $('order-1')],
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
  horn: 'none'
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

/* ================================================================ voice */

/*
 * `speechSynthesis.speaking` is worth nothing: measured in Chrome 151 it stays
 * true for ever on a queued utterance that never starts. Only `start` proves a
 * voice, and the sequence moves on at an estimate as well as on `end`, so a
 * dead engine costs an announcement its timing and never its second team.
 */

const VOICE_START_MS = 1500;

let announceToken = 0;
let chosenVoice = null;

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
  chosenVoice = pool
    .slice()
    .sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)))[0] || null;
}

/** Roughly how long a line takes to say, at rate 0.95 with its full stops. */
function sayMs(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.min(5200, 800 + words * 360);
}

function haveVoice() {
  return 'speechSynthesis' in window;
}

/* Only ever called when there is something in the queue to take out. */
function clearVoice() {
  if (!haveVoice()) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  } catch (error) { /* ignore */ }
}

function utteranceFor(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (chosenVoice) {
    utterance.voice = chosenVoice;
    utterance.lang = chosenVoice.lang;
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
    utterance.onstart = () => { state.degradedVoice = false; };
    speechSynthesis.speak(utterance);
    voiceUnlocked = true;
    const asked = voiceAsks;
    window.setTimeout(() => {
      if (voiceAsks === asked) clearVoice();
    }, VOICE_START_MS);
  } catch (error) {
    state.degradedVoice = true;
  }
}

function speak(text, onEnd) {
  voiceAsks += 1;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (onEnd) onEnd();
  };
  if (!haveVoice()) {
    state.degradedVoice = true;
    finish();
    return;
  }
  try {
    if (speechSynthesis.paused) speechSynthesis.resume();
    const utterance = utteranceFor(text);
    let started = false;
    utterance.onstart = () => {
      started = true;
      state.degradedVoice = false;
    };
    utterance.onend = finish;
    utterance.onerror = (event) => {
      /* a cancel is our own doing, not a lost voice */
      const reason = event && event.error;
      if (reason !== 'canceled' && reason !== 'interrupted') state.degradedVoice = true;
      finish();
    };
    speechSynthesis.speak(utterance);
    window.setTimeout(() => {
      if (!started && !done) state.degradedVoice = true;
    }, VOICE_START_MS);
    window.setTimeout(finish, sayMs(text));
  } catch (error) {
    state.degradedVoice = true;
    finish();
  }
}

function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/*
 * ONE TEMPLATE, THE STATE AND NOT THE TRANSITION
 *
 *   [chime] Bibs. Goal, Umar. Sub, Kevin.
 *
 * The same words the screen shows, so the two never disagree. It says who is
 * in goal and who is sitting down, never who is leaving, because a state is
 * true for the next ten minutes and a transition is true for a second. A team
 * with no subs drops the clause — `No subs` is information nobody can act on.
 *
 * The name is spoken exactly as it was typed. The screen's uppercase is a
 * `text-transform` and never reaches the engine.
 */
function said(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function lineFor(teamIndex, keeper, subs) {
  if (!keeper) return null;
  const bits = [`${said(TEAM_NAMES[teamIndex])}.`, `${COPY.goal}, ${keeper.name}.`];
  const names = subs.map((player) => player.name);
  if (names.length > 0) {
    bits.push(`${said(names.length > 1 ? COPY.subs : COPY.sub)}, ${joinNames(names)}.`);
  }
  return bits.join(' ');
}

/* the change is ten seconds away, so the state it describes is the next one */
function linesForChange(r) {
  return r.teams.map((team, t) => lineFor(t, team.nextKeeper, team.nextSubs)).filter(Boolean);
}

/* at kick-off the state it describes is this one */
function linesForKickOff(r) {
  return r.teams.map((team, t) => lineFor(t, team.keeper, team.subs)).filter(Boolean);
}

function announce(lines) {
  announceToken += 1;
  const token = announceToken;
  /* the one cancel per announcement, and only if there is a queue to take out */
  clearVoice();
  let i = 0;
  const next = () => {
    if (token !== announceToken || i >= lines.length) return;
    const text = lines[i];
    i += 1;
    const wait = chime();
    window.setTimeout(() => {
      if (token !== announceToken) return;
      speak(text, next);
    }, wait + 70);
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
    el.squads[t].classList.toggle('filled', draft.players[t].length > 0);
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
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitField(t);
  });
});

el.enters.forEach((button, t) => {
  button.addEventListener('click', () => commitField(t));
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
function openSheet(title, options) {
  state.sheet = options;
  el.sheetTitle.textContent = title;
  el.sheetOpts.innerHTML = options.map((option, i) => (
    `<button class="opt${option.on ? ' on' : ''}" type="button" data-opt="${i}"` +
    (option.toggle ? ` aria-pressed="${String(Boolean(option.on))}"` : '') +
    `><span class="dsp">${safe(option.label)}</span></button>`
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
 *   KEVIN
 *   [FIXED GOALIE] [LATE]
 *
 * An eyebrow over a row of controls, 12px between them and 20px of padding
 * round. There is still no switch and no tick — the word is the control — but
 * the state is now the shape it sits in and not how loud it is: a white fill
 * on, an outline off, and the one grey while a finger is on it.
 */
function openPlayerSheet(teamIndex, index) {
  const player = draft.players[teamIndex][index];
  if (!player) return;
  const refresh = () => {
    renderSetup();
    saveSquad();
    openPlayerSheet(teamIndex, index);
  };
  openSheet(player.name, [
    {
      label: COPY.fixedGoalie,
      on: Boolean(player.fixedGoalie),
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
      on: Boolean(player.late),
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
 * The right-hand column: the whole squad in rotation order, with a glove on
 * whoever is next in goal and the arrows on whoever is next off. Everything
 * that column needs comes out of the engine — there is no arithmetic here.
 */
function orderRows(team) {
  const subs = new Set(team.nextSubIndexes || []);
  return (team.order || []).map((player, i) => {
    const mark = i === team.nextKeeperIndex ? 'i-glove' : subs.has(i) ? 'i-swap' : null;
    const glyph = mark ? icon(mark, 'ic12') : icon('i-swap', 'ic12 blank');
    return `<div class="orow">${glyph}<span class="on">${safe(player.name)}</span></div>`;
  }).join('');
}

/*
 * A NAME THAT DOES NOT FIT IS SET SMALLER, NOT CUT OFF
 *
 * The design's longest keeper is KEVIN and its longest squad name is LORENZO,
 * so nothing in the file ever reaches the edge of its column. A real squad
 * does: LORENZO at 50px is 157px against a 151px column, and clipping it turns
 * the one thing the screen exists to say into LORENZ. So a line that is too
 * wide is scaled down until it fits, and every name in the design is untouched
 * because every name in the design already fits.
 */
const FIT_FLOOR = 24;

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
  document.querySelectorAll('.keeper, .sn, .nm').forEach(fitLine);
}

window.addEventListener('resize', fitNames);

function paint(r) {
  (r.teams || []).forEach((team, t) => {
    el.keepers[t].textContent = team.keeper ? team.keeper.name : '';

    const subs = team.subs || [];
    el.subSlots[t].classList.toggle('empty', subs.length === 0);
    el.subLabels[t].textContent = subs.length === 1 ? COPY.sub : COPY.subs;
    el.subs[t].classList.toggle('solo', subs.length === 1);
    el.subs[t].innerHTML = subs
      .map((player) => `<p class="sn dsp">${safe(player.name)}</p>`)
      .join('');

    el.orders[t].innerHTML = orderRows(team);
  });
  fitNames();
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
  const r = engine.rotation(state.game.setup, elapsed);
  const inWindow = r.msToNextChange <= WINDOW_MS;

  /* the crossing, not the tick */
  if (r.changeIndex !== state.shownChange) {
    state.shownChange = r.changeIndex;
    state.windowFor = null;
    paint(r);
  }

  if (inWindow && state.windowFor !== r.changeIndex + 1) {
    state.windowFor = r.changeIndex + 1;
    /* a window walked in on late — a jump, or a phone that woke up in it — was
       missed, not announced. Everything else is a real warning. */
    if (r.msToNextChange >= WINDOW_MS - 900) {
      const wait = horn();
      window.setTimeout(() => announce(linesForChange(r)), wait + VOICE_GAP_MS);
    }
  }

  setCounting(inWindow);
  setLabel(COPY.nextRotation);
  setGauge(inWindow ? 0 : r.msToNextChange / r.intervalMs);
  setCount(inWindow
    ? String(Math.max(1, Math.ceil(r.msToNextChange / 1000)))
    : mmss(r.msToNextChange));

  const watch = elapsedWords(elapsed);
  if (watch !== state.watchText) {
    state.watchText = watch;
    el.watch.textContent = watch;
  }

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
  paint(r);
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
  setGauge(0);
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
    setup
  };
  state.screen = 'game';
  state.shownChange = null;
  state.windowFor = null;
  state.countText = '';
  setCounting(false);
  showGame();
  saveGame();

  const wait = horn();
  const r = engine.rotation(setup, Math.max(0, elapsedMs()));
  /* the same order as a changeover: the horn finishes, then the names */
  window.setTimeout(() => announce(linesForKickOff(r)), wait + VOICE_GAP_MS);

  startLoop();
  tick();
}

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
  stopLoop();
  showSetup();
}

function goHome() {
  closeSheet();
  stopLoop();
  announceToken += 1;
  try { speechSynthesis.cancel(); } catch (error) { /* ignore */ }

  /* the game goes first, so the lock's own release handler does not read the
     let-go as a screen that failed to stay awake */
  state.game = null;
  releaseWakeLock();
  state.shownChange = null;
  state.windowFor = null;
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
  const elapsed = Date.now() - game.kickoff;
  const minutes = Number(game.setup.gameMinutes) || GRID.time.def;
  const limit = (minutes + 60) * MS_PER_MINUTE;
  if (elapsed < 0 || elapsed > limit) {
    dropKey(KEY_GAME);
    return false;
  }

  state.game = { kickoff: game.kickoff, setup: game.setup };
  if (debug) state.game.kickoff = nowMs() - debug.offsetMs;
  state.screen = 'game';

  const now = elapsedMs();
  const r = engine.rotation(state.game.setup, now);
  /* no dialog, and no voice for changes missed while the phone was dead */
  state.shownChange = r.changeIndex;
  if (r.msToNextChange <= WINDOW_MS) state.windowFor = r.changeIndex + 1;
  showGame();
  paint(r);
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
    view: () => (state.game ? engine.rotation(state.game.setup, elapsedMs()) : null),
    getElapsed: () => elapsedMs(),
    setElapsed(ms) {
      if (!state.game) return 0;
      state.game.kickoff = nowMs() - Math.max(0, Number(ms) || 0);
      tick();
      return elapsedMs();
    },
    rate(n) {
      debug.origin = nowMs();
      debug.realOrigin = Date.now();
      debug.rate = Math.max(0, Number(n) || 0);
      return debug.rate;
    },
    kickOff: () => el.kick.click(),
    sheet: (t, i) => openPlayerSheet(t, i),
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

if ('serviceWorker' in navigator && !debug) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* no service worker is still a working page, just not an offline one */
    });
  });
}
