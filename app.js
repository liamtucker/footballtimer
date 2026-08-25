/*
 * app.js — the two screens around rotation.js.
 *
 * rotation.js holds the whole rota and nothing here recomputes any part of it.
 * This file owns the setup screen, the game screen, the sounds, the voice, the
 * wake lock, persistence and the edit route.
 *
 * THE GAME IS A LIST OF EPOCHS
 *
 * A game is a kick-off timestamp and one or two epochs. An epoch is
 * `{ fromMs, index0, setup }` — from this elapsed time, under this setup, and
 * the first change it covers is numbered index0. At kick-off there is one
 * epoch, `{ 0, 0, setup }`. An edit made mid-game writes a second epoch that
 * starts at the next change boundary, which is how an edit lands at the next
 * change and never mid-shift. Everything stays a pure function of
 * (epochs, elapsed), so a dead phone restores and carries on.
 *
 * THE SETUP SCREEN SHOWS THE NEXT CHANGE
 *
 * Mid-game the list is the ring rotated so that the subs at the NEXT change sit
 * below the divider and the keeper at the next change carries the marker. That
 * makes the anchor the edit writes identical in form to the one kick-off
 * writes — `{ changeIndex: 0, keeperIndex: marker, subIndex: gameType }` — so
 * an edit that changes nothing produces exactly the same rota, and the legal
 * window for the marker is the same rule on both screens.
 */

import {
  createSetup,
  rotation,
  kickOff as drawKeepers,
  setStartKeeper,
  isLegalStartKeeper,
  nearestLegalStartKeeper,
  legalStartKeepers,
  gameTypeOf,
  rotationsOf,
  squadSizeOf,
  computeIntervalMs,
  rotationsPerPlayer,
  MIN_GAME_TYPE,
  MAX_GAME_TYPE,
  MIN_ROTATIONS,
  MAX_ROTATIONS,
  DEFAULT_GAME_TYPE,
  DEFAULT_ROTATIONS,
  DEFAULT_GAME_MINUTES
} from './rotation.js';

import { buildAlarm, buildChime, buildTick, ALARM_MS } from './sound.js';

const MS_PER_MINUTE = 60000;
const NAME_MAX = 10;
const WINDOW_MS = 10000;
const COUNTDOWN_S = 10;
/* the silence between the alarm ending and the first chime */
const VOICE_GAP_MS = 150;

/* Every string, lifted from brain/copy.md. */
const COPY = {
  teamA: 'bibs',
  teamB: 'non-bibs',
  addPlaceholder: 'Add a name',
  divider: 'SUBS',
  keeperTag: 'GOAL',
  gameTypeLabel: 'Game',
  gameTimeLabel: 'Time',
  rotationsLabel: 'Rotations',
  /* the readout is one sentence. before kick-off it says the interval the
     three settings produce; mid-game it says what that frozen interval is
     worth to the squad as it now stands. */
  readoutEvery: 'Change every',
  readoutEach: 'rotations each',
  readoutNone: '—',
  start: 'Kick off',
  clear: 'Clear all',
  editAria: 'Edit setup',
  homeAria: 'End the game',
  endWarning: 'This will end your current game.',
  yes: 'Yes',
  no: 'No',
  keeper: 'GOAL',
  sub: 'SUB',
  subs: 'SUBS',
  subsNone: 'NO SUBS',
  errorTooSmall: 'Two names minimum.',
  warnDuplicate: 'Same name twice. Add an initial.',
  pending: 'Edits land at the next change',
  noVoice: 'No voice',
  noLock: 'Screen may sleep',
  chipLabel: 'Next change',
  muteOn: 'Mute voice',
  muteOff: 'Unmute voice',
  closeAria: 'Close setup'
};

const TEAM_NAMES = [COPY.teamA, COPY.teamB];

/* ------------------------------------------------------------- storage */

const KEY_GAME = 'rota.game';
const KEY_SQUAD = 'rota.squad';

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
  } catch (error) {
    /* ignore */
  }
}

/* --------------------------------------------------------------- clock */

/*
 * Debug hook. Inert unless `?t=` is in the URL. Nothing is written to
 * localStorage while it is on and window.rota does not otherwise exist.
 *
 *   ?t=0 | ?t=330 | ?t=5:30   start the game clock there
 *   &rate=60                  run 60x real time. &rate=0 freezes it
 *   &a=Dom,Dave,Chris         team A squad
 *   &b=Sam,Tom,Alex           team B squad
 *   &g=7                      game type
 *   &game=120                 the game time
 *   &rot=2                    rotations each
 *   &ka=2 &kb=3               force the starting keeper index per team
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
    keepers: [int('ka'), int('kb')],
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

function mod(a, b) {
  return ((a % b) + b) % b;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isPortrait() {
  return window.matchMedia('(orientation: portrait)').matches;
}

/* --------------------------------------------------------------- state */

const draft = {
  gameType: DEFAULT_GAME_TYPE,
  gameMinutes: DEFAULT_GAME_MINUTES,
  rotations: DEFAULT_ROTATIONS,
  names: [[], []],
  keeper: [null, null],
  mode: 'pre',        /* 'pre' before kick-off, 'edit' with a game running */
  baseChange: 0,      /* the change index the edit picture was built from */
  signature: '',
  /* the interval the kick-off froze, and the four settings it was worked out
     from. Only set in edit mode. See frozenIntervalForDraft(). */
  frozen: null
};

const state = {
  screen: 'setup',
  game: null,        /* { kickoff, epochs: [...], gone: [[], []] } */
  shownChange: null,
  windowFor: null,
  countdownAt: 0,
  countdownLeft: 0,
  clockText: '',
  pendingEdit: false,
  degradedVoice: false,
  degradedLock: false,
  muted: false
};

const $ = (id) => document.getElementById(id);

const el = {
  body: document.body,
  setup: $('setup'),
  display: $('display'),
  labels: [$('label-0'), $('label-1')],
  lists: [$('list-0'), $('list-1')],
  inputs: [$('input-0'), $('input-1')],
  adds: [$('add-0'), $('add-1')],
  values: {
    type: $('type-value'),
    time: $('time-value'),
    rotations: $('rotations-value')
  },
  readout: $('readout'),
  readoutLabel: $('readout-label'),
  readoutValue: $('readout-value'),
  notice: $('notice'),
  start: $('start'),
  clear: $('clear'),
  livebar: $('livebar'),
  liveClock: $('live-clock'),
  liveNote: $('live-note'),
  clock: $('clock'),
  notes: $('notes'),
  edit: $('edit'),
  home: $('home'),
  confirm: $('confirm'),
  confirmText: $('confirm-text'),
  confirmYes: $('confirm-yes'),
  confirmNo: $('confirm-no')
};

const teamEls = [0, 1].map((t) => {
  const root = el.display.querySelector(`.team[data-team="${t}"]`);
  return {
    root,
    name: root.querySelector('.team-title'),
    lab: root.querySelector('.lab'),
    labSub: root.querySelector('.lab-sub'),
    hero: root.querySelector('.hero'),
    subname: root.querySelector('.subname'),
    line3: root.querySelector('.l3-goal'),
    l3sub: root.querySelector('.l3-sub'),
    strip: root.querySelector('.strip'),
    track: root.querySelector('.strip-track')
  };
});

/* ================================================================ sound */

/*
 * Two sounds, two meanings, never swapped. The alarm says the moment is now —
 * kick-off, and every changeover. The chime says names follow. Both are
 * synthesised in sound.js — no files, no network — and the context is created
 * inside a gesture so iOS unlocks it.
 */

let ac = null;
let gestured = false;

/*
 * The context is created inside a gesture and never before. A game restored
 * after a reload has had no gesture yet, so it makes no sound — and the first
 * touch anywhere brings it back.
 */
function audio() {
  if (ac) return ac;
  if (!gestured) return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ac = new Ctor();
  } catch (error) {
    ac = null;
  }
  return ac;
}

function markGesture() {
  gestured = true;
  audio();
  resumeAudio();
}

function resumeAudio() {
  if (!ac) return;
  if (ac.state === 'suspended' || ac.state === 'interrupted') {
    try { ac.resume(); } catch (error) { /* ignore */ }
  }
}

/*
 * The alarm. The same sound at kick-off and at every changeover, two and a
 * half seconds of two-tone klaxon. It replaced a whistle that nobody on a
 * touchline could hear: that whistle measured 0.075 RMS against a 0.344 peak,
 * and this measures 0.469 against 0.936 — six and a quarter times the RMS for
 * the same headroom, and it does not clip. sound.js has the reasoning.
 *
 * Returns its length in milliseconds, so the caller can put the voice after it
 * rather than under it.
 */
function alarm() {
  const ctx = audio();
  if (!ctx) return ALARM_MS;
  resumeAudio();
  buildAlarm(ctx, ctx.currentTime + 0.01, ctx.destination);
  return ALARM_MS;
}

/* 660 then 880. The same tone every time, before each team. */
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
 * THE VOICE WORKS. IT IS STILL WORTH MAKING IT HARDER TO BREAK
 *
 * It has been heard on Liam's phone, so nothing here is a repair. Two things
 * were still risks and both are gone:
 *
 * 1. The unlock spoke a whitespace-only utterance at `volume = 0`. Both
 *    engines have form for wedging on an empty or silent utterance, after
 *    which `speaking` stays true for ever and every later `speak()` queues
 *    behind it and is never heard. The unlock now speaks real text at a real
 *    volume, and cancels itself if it has not finished in a second and a half.
 *
 * 2. `speechSynthesis.cancel()` ran before every single `speak()`. A cancel is
 *    only needed when something is actually in the queue, and the sequence now
 *    moves on at an estimate as well as on `end` — so an unconditional cancel
 *    could cut a line that was still being spoken. It runs once per
 *    announcement, and only when there is a queue to take out.
 *
 * WHAT `speaking` IS WORTH
 *
 * Nothing. Measured in Chrome 151: an utterance can sit with
 * `speechSynthesis.speaking === true` for ever, with `onstart`, `onend` and
 * `onerror` all silent. So the old watchdog — mark the voice broken when
 * `!speaking && !pending` — could not fire on the one failure that matters,
 * and the only honest test of a working voice is whether `start` fired.
 *
 * The sequence no longer depends on `end` either. Every line has a spoken
 * estimate beside it and moves on at whichever arrives first, so a dead engine
 * costs the announcement its timing and never its second team.
 */

const VOICE_START_MS = 1500;   /* start has to fire inside this or it is lost */

let announceToken = 0;
let chosenVoice = null;

/*
 * en-GB and local first. This is proven on the phone, so it stays: an engine
 * left to pick for itself can land on a US voice halfway through a season.
 */
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

function voiceCount() {
  if (!haveVoice()) return 0;
  try {
    return (speechSynthesis.getVoices() || []).length;
  } catch (error) {
    return 0;
  }
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
 * user gesture. This is that once. The text is real and the volume is not
 * zero, because an empty utterance and a silent one are the two shapes known
 * to leave the queue stuck.
 */
function unlockVoice() {
  if (!haveVoice()) {
    state.degradedVoice = true;
    return;
  }
  try {
    /* a paused engine is the commonest wedge and resume() costs nothing */
    speechSynthesis.resume();
    const utterance = utteranceFor('rota');
    utterance.volume = 0.02;
    utterance.onstart = () => { state.degradedVoice = false; };
    speechSynthesis.speak(utterance);
    /* and if it does stick, it must not still be there when the names are */
    window.setTimeout(clearVoice, VOICE_START_MS);
  } catch (error) {
    state.degradedVoice = true;
  }
}

function speak(text, onEnd) {
  if (state.muted) {
    /* hold the slot open so the two chimes keep their spacing */
    if (onEnd) window.setTimeout(onEnd, 800);
    return;
  }
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
    /* whether `start` fired is the only honest test. it does not end the line:
       a voice that is late is not a voice that is lost. */
    window.setTimeout(() => {
      if (!started && !done) state.degradedVoice = true;
    }, VOICE_START_MS);
    /* and the line moves on at the estimate whatever the engine does, so one
       stuck utterance never swallows the team after it */
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
 * The same words the screen shows — `GOAL` over a name and `SUB` or `SUBS`
 * over the rest — so the two never disagree. It says who is in goal and who is
 * sitting down, never who is leaving, because a state is true for the next ten
 * minutes and a transition is true for a second.
 *
 * A team with no subs drops the clause. `No subs` is never said out loud: it
 * is information nobody can act on.
 *
 * Full stops, not commas, between the three facts. The synthesiser honours a
 * full stop with a real pause and runs a comma straight through, and a name
 * run into the next name is the one thing that cannot happen here. The team
 * comes first so nobody parses a name that is not theirs.
 *
 * The name is spoken exactly as it was typed. The screen's uppercase is a
 * `text-transform` and never reaches the engine.
 */
function lineFor(teamIndex, keeper, subs) {
  if (!keeper) return null;
  const bits = [`${TEAM_NAMES[teamIndex]}.`, `Goal, ${keeper.name}.`];
  const names = subs.map((player) => player.name);
  if (names.length > 0) {
    bits.push(`${names.length > 1 ? COPY.subs : COPY.sub}, ${joinNames(names)}.`);
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

/* ================================================================= mute */

/*
 * On by default. Muted is the same icon with a line through it and nothing
 * else changed — no second shape to learn, no colour and no container, so the
 * two states differ by exactly the thing that says off. It silences the voice
 * and nothing else: the whistle and the chime are separate sounds and they
 * still land.
 *
 * It also suppresses `No voice`. A muted phone and a broken one look alike on
 * a spine and mean opposite things.
 */

const SPEAKER = '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>' +
  '<path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>';

const ICON_SVG = (extra) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  SPEAKER + extra + '</svg>';

const ICON_UNMUTED = ICON_SVG('');
const ICON_MUTED = ICON_SVG('<path d="m3 3 18 18"/>');

function renderMute() {
  const label = state.muted ? COPY.muteOff : COPY.muteOn;
  for (const node of document.querySelectorAll('.mute')) {
    node.innerHTML = state.muted ? ICON_MUTED : ICON_UNMUTED;
    node.setAttribute('aria-label', label);
    node.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
  }
}

function toggleMute() {
  state.muted = !state.muted;
  if (state.muted) {
    announceToken += 1;
    try { speechSynthesis.cancel(); } catch (error) { /* ignore */ }
  }
  renderMute();
  setNotes();
}

for (const node of document.querySelectorAll('.mute')) {
  node.addEventListener('click', (event) => {
    /* a tap on the mute is not a tap on the screen: it must not abort the
       kick-off countdown and it must not re-open the edit route */
    event.preventDefault();
    event.stopPropagation();
    markGesture();
    toggleMute();
  });
}

renderMute();

/* ========================================================= setup screen */

/*
 * The interval freezes at kick-off, so an edit mid-game has to carry the frozen
 * number forward or the countdown would jump the moment somebody's name is
 * typed in. It carries it as long as the two settings the number came from are
 * untouched. Move either of them and this returns undefined, the setup derives
 * again, and the new interval lands at the next change like every other edit —
 * which is a person deciding to change the pace, not a squad changing size.
 */
function frozenIntervalForDraft() {
  const was = draft.frozen;
  if (!was) return undefined;
  if (draft.rotations !== was.rotations) return undefined;
  if (draft.gameMinutes !== was.gameMinutes) return undefined;
  return was.intervalMs;
}

function draftSetup() {
  return createSetup({
    gameType: draft.gameType,
    gameMinutes: draft.gameMinutes,
    rotations: draft.rotations,
    intervalMs: frozenIntervalForDraft(),
    teams: [
      { name: TEAM_NAMES[0], players: draft.names[0] },
      { name: TEAM_NAMES[1], players: draft.names[1] }
    ]
  });
}

function draftSignature() {
  return JSON.stringify({
    g: draft.gameType,
    m: draft.gameMinutes,
    r: draft.rotations,
    n: draft.names,
    k: draft.keeper
  });
}

function xIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
}

function buildRow(teamIndex, index, name, isKeeper) {
  const row = document.createElement('div');
  row.className = isKeeper ? 'row keeper' : 'row';
  row.dataset.team = String(teamIndex);
  row.dataset.index = String(index);

  const label = document.createElement('span');
  label.className = 'row-name';
  label.textContent = name;
  row.appendChild(label);

  /* the marker is right aligned, so every name keeps the same left edge */
  if (isKeeper) {
    const tag = document.createElement('span');
    tag.className = 'keeper-tag';
    tag.textContent = COPY.keeperTag;
    row.appendChild(tag);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'row-x';
  remove.innerHTML = xIcon();
  remove.setAttribute('aria-label', 'remove');

  row.appendChild(remove);
  return row;
}

function buildDivider() {
  const node = document.createElement('div');
  node.className = 'divider';
  const label = document.createElement('span');
  label.className = 'divider-label';
  label.textContent = COPY.divider;
  const rule = document.createElement('span');
  rule.className = 'divider-rule';
  node.appendChild(label);
  node.appendChild(rule);
  return node;
}

function renderList(teamIndex) {
  const list = el.lists[teamIndex];
  const names = draft.names[teamIndex];
  const keeper = draft.keeper[teamIndex];
  list.textContent = '';
  names.forEach((name, i) => {
    if (names.length > draft.gameType && i === draft.gameType) list.appendChild(buildDivider());
    list.appendChild(buildRow(teamIndex, i, name, i === keeper));
  });
}

function armAdd(teamIndex) {
  el.adds[teamIndex].classList.toggle('armed', el.inputs[teamIndex].value.trim().length > 0);
}

function duplicateIn(names) {
  const seen = new Set();
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/* a numeral, then the unit spelled the way it is said out loud. whole hours
   drop the minutes — `120 min` makes a person do maths. */
function durationWords(minutes) {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} minutes`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  const word = hours === 1 ? 'hour' : 'hours';
  return rest === 0 ? `${hours} ${word}` : `${hours} ${word} ${rest}`;
}

function renderSetup() {
  for (let t = 0; t < 2; t += 1) {
    el.labels[t].textContent = TEAM_NAMES[t];
    renderList(t);
    armAdd(t);
  }

  renderPickers();

  const sizes = draft.names.map((names) => names.length);
  const valid = sizes.every((n) => n >= 2);
  const anyTyped = sizes.some((n) => n > 0);
  const duplicate = draft.names.some(duplicateIn);

  let notice = '';
  if (!valid && anyTyped) notice = COPY.errorTooSmall;
  else if (duplicate) notice = COPY.warnDuplicate;
  el.notice.textContent = notice;
  el.notice.hidden = notice === '';

  /* the ink moves: a corner button before kick-off, the top bar during */
  const editing = draft.mode === 'edit';
  el.start.hidden = editing;
  el.livebar.hidden = !editing;
  el.setup.classList.toggle('live', editing);
  el.start.classList.toggle('hairline', !valid);

  /* Clear all empties both lists. It exists because the squad is remembered
     between games, and a remembered squad with no way out is a trap. It never
     shows mid-game — ending the game is the stop square, and the two must not
     be confused. */
  el.clear.textContent = COPY.clear;
  el.clear.hidden = editing || !anyTyped;

  const dirty = editing && (state.pendingEdit ||
    (draft.signature !== '' && draftSignature() !== draft.signature));
  el.liveNote.textContent = dirty ? COPY.pending : '';
}

/* --------------------------------------------------------- the marker */

/*
 * One rule on both screens: the marked row may only sit on an index the engine
 * calls a legal start. A tap on any name makes them the keeper, and if their
 * row is not on a legal index the row moves to the nearest one first. No row is
 * ever refused and the move is what tells the person what happened.
 */
function legalTargetFor(teamIndex, index) {
  const setup = draftSetup();
  if (legalStartKeepers(setup, teamIndex).length === 0) return -1;
  const recorded = setStartKeeper(setup, teamIndex, index);
  const anchor = recorded.teams[teamIndex].anchor;
  return anchor ? anchor.keeperIndex : nearestLegalStartKeeper(setup, teamIndex, index);
}

function chooseKeeper(teamIndex, index) {
  const target = legalTargetFor(teamIndex, index);
  if (target < 0) return;
  if (target === index) {
    draft.keeper[teamIndex] = index;
    renderSetup();
    return;
  }
  moveRow(teamIndex, index, target, 'landing');
  draft.keeper[teamIndex] = target;
  renderSetup();
}

/* After anything that changes the list, the marker must still be legal. */
function reseatKeeper(teamIndex) {
  const index = draft.keeper[teamIndex];
  if (index == null) return;
  const names = draft.names[teamIndex];
  if (index < 0 || index >= names.length) {
    draft.keeper[teamIndex] = null;
    return;
  }
  const setup = draftSetup();
  if (isLegalStartKeeper(setup, teamIndex, index)) return;
  const target = legalTargetFor(teamIndex, index);
  if (target < 0) {
    draft.keeper[teamIndex] = null;
    return;
  }
  moveRow(teamIndex, index, target, 'landing');
  draft.keeper[teamIndex] = target;
}

/* --------------------------------------------------- moving a row about */

function rowNodes(teamIndex) {
  return [...el.lists[teamIndex].children];
}

function captureRects(nodes) {
  return nodes.map((node) => node.getBoundingClientRect());
}

/* Move one name and let everything else shift around it, on a transform. */
function moveRow(teamIndex, from, to, cls) {
  const names = draft.names[teamIndex];
  if (from === to || from < 0 || from >= names.length) return;
  const nodes = rowNodes(teamIndex);
  const before = new Map();
  nodes.forEach((node) => before.set(node.dataset.index ?? `d${node.className}`, node.getBoundingClientRect()));

  const [name] = names.splice(from, 1);
  names.splice(to, 0, name);
  const keeper = draft.keeper[teamIndex];
  if (keeper != null) draft.keeper[teamIndex] = shiftIndex(keeper, from, to);
  renderList(teamIndex);

  if (prefersReducedMotion()) return;
  const after = rowNodes(teamIndex);
  const map = new Map();
  const order = names.map((_, i) => i);
  /* old index -> new index */
  order.forEach(() => {});
  const oldOf = (newIndex) => {
    if (newIndex === to) return from;
    let j = newIndex < to ? newIndex : newIndex - 1;
    return j < from ? j : j + 1;
  };
  after.forEach((node) => {
    if (!node.classList.contains('row')) return;
    const newIndex = Number(node.dataset.index);
    const key = String(oldOf(newIndex));
    map.set(node, before.get(key));
  });
  after.forEach((node) => {
    const rect = map.get(node);
    if (!rect) return;
    const now = node.getBoundingClientRect();
    const dy = rect.top - now.top;
    if (Math.abs(dy) < 0.5) return;
    node.style.transform = `translateY(${dy}px)`;
  });
  requestAnimationFrame(() => {
    after.forEach((node) => {
      if (!node.style.transform) return;
      node.classList.add(cls || 'shifting');
      node.style.transform = '';
    });
    window.setTimeout(() => {
      after.forEach((node) => node.classList.remove('shifting', 'landing', 'settling'));
    }, 320);
  });
}

function shiftIndex(index, from, to) {
  if (index === from) return to;
  let j = index > from ? index - 1 : index;
  return j >= to ? j + 1 : j;
}

/* -------------------------------------------------------------- naming */

function addName(teamIndex, raw) {
  const name = String(raw).trim().slice(0, NAME_MAX);
  if (!name) return false;
  const names = draft.names[teamIndex];
  if (draft.mode === 'edit' && names.length >= draft.gameType) {
    /* a late arrival joins the front of the bench and comes on at the next
       change. nobody on the pitch moves. */
    names.splice(draft.gameType, 0, name);
    const keeper = draft.keeper[teamIndex];
    if (keeper != null && keeper >= draft.gameType) draft.keeper[teamIndex] = keeper + 1;
  } else {
    names.push(name);
  }
  renderSetup();
  reseatKeeper(teamIndex);
  renderSetup();
  scrollToName(teamIndex, name);
  return true;
}

function scrollToName(teamIndex, name) {
  const list = el.lists[teamIndex];
  const index = draft.names[teamIndex].indexOf(name);
  const row = list.querySelector(`.row[data-index="${index}"]`);
  if (!row) return;
  if (isPortrait()) return;
  row.scrollIntoView({ block: 'nearest' });
}

function removeName(teamIndex, index) {
  const names = draft.names[teamIndex];
  if (index < 0 || index >= names.length) return;
  names.splice(index, 1);
  const keeper = draft.keeper[teamIndex];
  if (keeper != null) {
    if (keeper === index) draft.keeper[teamIndex] = draft.mode === 'edit' ? Math.min(keeper, names.length - 1) : null;
    else if (keeper > index) draft.keeper[teamIndex] = keeper - 1;
  }
  renderSetup();
  reseatKeeper(teamIndex);
  renderSetup();
}

function commitField(teamIndex) {
  const input = el.inputs[teamIndex];
  const value = input.value;
  input.value = '';
  armAdd(teamIndex);
  return addName(teamIndex, value);
}

for (let t = 0; t < 2; t += 1) {
  const input = el.inputs[t];
  input.addEventListener('input', () => armAdd(t));
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitField(t);
    input.focus();
  });
  el.adds[t].addEventListener('click', (event) => {
    event.preventDefault();
    commitField(t);
    input.focus();
  });
  /* a half-typed name must survive the blur a tap elsewhere causes */
  input.addEventListener('blur', () => {
    if (!input.value.trim()) return;
    window.setTimeout(() => {
      if (!input.value.trim()) return;
      commitField(t);
    }, 0);
  });
}

/* ---------------------------------------------------------------- drag */

/*
 * Pointer Events, `touch-action: none` on the row, and a 6px threshold before
 * anything is treated as a drag — a stray tap would silently reassign the
 * keeper, so a drag must never read as a tap.
 */

let drag = null;

function beginDrag(event) {
  const row = event.target.closest('.row');
  if (!row) return;
  if (event.target.closest('.row-x')) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const teamIndex = Number(row.dataset.team);
  const index = Number(row.dataset.index);
  drag = {
    row,
    teamIndex,
    index,
    target: index,
    startY: event.clientY,
    startX: event.clientX,
    active: false,
    pointerId: event.pointerId
  };
  try { row.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
}

function startDragging() {
  const list = el.lists[drag.teamIndex];
  const rect = drag.row.getBoundingClientRect();
  drag.offsetY = drag.startY - rect.top;
  drag.gap = document.createElement('div');
  drag.gap.className = 'gap';
  drag.gap.style.height = `${rect.height}px`;
  list.insertBefore(drag.gap, drag.row);
  drag.row.style.width = `${rect.width}px`;
  drag.row.style.height = `${rect.height}px`;
  drag.row.style.left = `${rect.left}px`;
  drag.row.style.top = `${rect.top}px`;
  drag.row.classList.add('dragging');
  drag.active = true;
}

function dragTargetIndex(event) {
  const list = el.lists[drag.teamIndex];
  const rows = [...list.querySelectorAll('.row')].filter((node) => node !== drag.row);
  const y = event.clientY - drag.offsetY + drag.row.offsetHeight / 2;
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return i;
  }
  return rows.length;
}

function layoutDrag(target) {
  const list = el.lists[drag.teamIndex];
  const others = [...list.querySelectorAll('.row')].filter((node) => node !== drag.row);
  const divider = list.querySelector('.divider');
  const nodes = [...list.children].filter((node) => node !== drag.row);
  const before = captureRects(nodes);

  const slots = others.slice();
  slots.splice(target, 0, drag.gap);
  const total = slots.length;
  const ordered = [];
  slots.forEach((node, i) => {
    if (divider && total > draft.gameType && i === draft.gameType) ordered.push(divider);
    ordered.push(node);
  });
  if (divider && !ordered.includes(divider)) divider.remove();
  ordered.forEach((node) => list.appendChild(node));

  if (prefersReducedMotion()) return;
  nodes.forEach((node, i) => {
    if (!node.isConnected) return;
    const now = node.getBoundingClientRect();
    const dy = before[i].top - now.top;
    if (Math.abs(dy) < 0.5) return;
    node.classList.remove('shifting');
    node.style.transform = `translateY(${dy}px)`;
  });
  requestAnimationFrame(() => {
    nodes.forEach((node) => {
      if (!node.style.transform) return;
      node.classList.add('shifting');
      node.style.transform = '';
    });
  });
}

function onPointerMove(event) {
  if (!drag) return;
  if (!drag.active) {
    if (Math.abs(event.clientY - drag.startY) < 6 && Math.abs(event.clientX - drag.startX) < 6) return;
    startDragging();
  }
  event.preventDefault();
  drag.row.style.top = `${event.clientY - drag.offsetY}px`;
  autoScroll(event);
  const target = dragTargetIndex(event);
  if (target !== drag.target) {
    drag.target = target;
    layoutDrag(target);
  }
}

function autoScroll(event) {
  const list = el.lists[drag.teamIndex];
  if (list.scrollHeight <= list.clientHeight) return;
  const rect = list.getBoundingClientRect();
  if (event.clientY < rect.top + 28) list.scrollTop -= 12;
  else if (event.clientY > rect.bottom - 28) list.scrollTop += 12;
}

function endDrag(event, commit) {
  if (!drag) return;
  const current = drag;
  drag = null;
  try { current.row.releasePointerCapture(current.pointerId); } catch (error) { /* ignore */ }

  if (!current.active) {
    if (commit && draft.mode !== 'edit') chooseKeeper(current.teamIndex, current.index);
    return;
  }

  current.row.classList.remove('dragging');
  current.row.style.cssText = '';
  if (current.gap) current.gap.remove();

  if (commit && current.target !== current.index) {
    const names = draft.names[current.teamIndex];
    const [name] = names.splice(current.index, 1);
    names.splice(current.target, 0, name);
    const keeper = draft.keeper[current.teamIndex];
    if (keeper != null) draft.keeper[current.teamIndex] = shiftIndex(keeper, current.index, current.target);
  }
  renderSetup();
  reseatKeeper(current.teamIndex);
  renderSetup();
}

for (let t = 0; t < 2; t += 1) {
  const list = el.lists[t];
  list.addEventListener('pointerdown', beginDrag);
  list.addEventListener('pointermove', onPointerMove);
  list.addEventListener('pointerup', (event) => endDrag(event, true));
  list.addEventListener('pointercancel', (event) => endDrag(event, false));
  list.addEventListener('click', (event) => {
    const x = event.target.closest('.row-x');
    if (!x) return;
    const row = x.closest('.row');
    removeName(t, Number(row.dataset.index));
  });
  list.addEventListener('contextmenu', (event) => event.preventDefault());
}

/* ------------------------------------------------------------ pickers */

/*
 * One component, three slots. [-] value [+], 44px targets, and a press and hold
 * that repeats after 400ms at 8 a second. A bound makes the glyph --dim and
 * inert rather than disabled — there is no dead control here.
 *
 * Three pickers, three slots, and the interval is not one of them. It is not a
 * setting: it is what Game, Time and Rotations produce, and the readout under
 * the three says so. `onGrid()` snaps a stored value onto a picker's range.
 */

const PICKERS = {
  type: {
    label: COPY.gameTypeLabel,
    min: MIN_GAME_TYPE,
    max: MAX_GAME_TYPE,
    step: 1,
    get: () => draft.gameType,
    put(value) {
      draft.gameType = value;
      renderSetup();
      /* the divider moves, so the marker may no longer sit on a legal index */
      for (let t = 0; t < 2; t += 1) reseatKeeper(t);
      renderSetup();
    },
    text: (n) => `${n} a side`
  },
  /* `Time` is half of the interval sum now, so it drives the readout under it */
  time: {
    label: COPY.gameTimeLabel,
    min: 30,
    max: 180,
    step: 15,
    get: () => draft.gameMinutes,
    put(value) { draft.gameMinutes = value; renderSetup(); },
    text: durationWords
  },
  rotations: {
    label: COPY.rotationsLabel,
    min: MIN_ROTATIONS,
    max: MAX_ROTATIONS,
    step: 1,
    get: () => draft.rotations,
    put(value) { draft.rotations = value; renderSetup(); },
    text: (n) => `${n} each`
  }
};

const SLOTS = ['type', 'time', 'rotations'];

function pickerFor(slot) {
  return PICKERS[slot];
}

const stepButtons = [...document.querySelectorAll('.step')];

/*
 * COPY is the only place a string is written. Everything index.html carries as
 * text is set from it once, at boot, so no string can drift between the two
 * files and nothing in the table is left unused.
 */
function applyStaticCopy() {
  for (const input of el.inputs) {
    input.placeholder = COPY.addPlaceholder;
    input.setAttribute('aria-label', COPY.addPlaceholder);
  }
  for (const add of el.adds) add.setAttribute('aria-label', COPY.addPlaceholder);
  el.start.textContent = COPY.start;
  el.edit.setAttribute('aria-label', COPY.editAria);
  el.livebar.setAttribute('aria-label', COPY.closeAria);
  el.home.setAttribute('aria-label', COPY.homeAria);
  el.confirmText.textContent = COPY.endWarning;
  el.confirmYes.textContent = COPY.yes;
  el.confirmNo.textContent = COPY.no;
  /* the bar and the spine both hold one number, and it is the same number */
  el.clock.setAttribute('aria-label', COPY.chipLabel);
  el.liveClock.setAttribute('aria-label', COPY.chipLabel);
}

applyStaticCopy();

function renderPickers() {
  for (const slot of SLOTS) {
    const picker = pickerFor(slot);
    const card = el.values[slot].closest('.picker');
    card.setAttribute('aria-label', picker.label);
    card.querySelector('.picker-label').textContent = picker.label;
    const value = picker.get();
    el.values[slot].textContent = picker.text(value);
    for (const button of stepButtons) {
      if (button.dataset.pick !== slot) continue;
      const next = value + Number(button.dataset.dir) * picker.step;
      button.classList.toggle('bound', next < picker.min || next > picker.max);
    }
  }
  renderReadout();
}

/*
 * The number the three cards produce: `CHANGE EVERY 8:30`. It is not a
 * setting and it cannot be set — it is the result of the three above it, and
 * it moves as names are typed.
 *
 * Under two names in a squad there is no number worth showing, so it shows an
 * em-dash, which is also when the notice below says two names minimum.
 */
function renderReadout() {
  const setup = draftSetup();
  const known = squadSizeOf(setup) >= 2;
  el.readoutLabel.textContent = COPY.readoutEvery;
  el.readoutValue.textContent = known ? formatCountdown(computeIntervalMs(setup)) : COPY.readoutNone;
}

let holdWait = 0;
let holdRepeat = 0;

function stopHold() {
  window.clearTimeout(holdWait);
  window.clearInterval(holdRepeat);
  holdWait = 0;
  holdRepeat = 0;
}

function bump(key, dir) {
  const picker = pickerFor(key);
  const next = picker.get() + dir * picker.step;
  if (next < picker.min || next > picker.max) return false;
  picker.put(next);
  return true;
}

for (const button of stepButtons) {
  const key = button.dataset.pick;
  const dir = Number(button.dataset.dir);
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    stopHold();
    if (!bump(key, dir)) return;
    try { button.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
    holdWait = window.setTimeout(() => {
      holdRepeat = window.setInterval(() => {
        if (!bump(key, dir)) stopHold();
      }, 125);
    }, 400);
  });
  button.addEventListener('pointerup', stopHold);
  button.addEventListener('pointercancel', stopHold);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

window.addEventListener('blur', stopHold);

/* ==================================================== the game, painted */

const DRIFT = [[0, 0], [2, 1], [0, 2], [-2, 1]];
let driftStep = 0;

function advanceDrift() {
  driftStep = (driftStep + 1) % DRIFT.length;
  applyDrift();
}

function applyDrift() {
  const [x, y] = DRIFT[driftStep];
  document.documentElement.style.setProperty('--drift-x', `${x}px`);
  document.documentElement.style.setProperty('--drift-y', `${y}px`);
}

/* one step of the scale, in pixels, whatever unit it is written in */
function scalePx(name) {
  const root = getComputedStyle(document.documentElement);
  const raw = String(root.getPropertyValue(name) || '').trim();
  const n = parseFloat(raw) || 0;
  return raw.endsWith('rem') ? n * (parseFloat(root.fontSize) || 16) : n;
}

/*
 * A name wider than its column is scaled down rather than wrapped or cut off.
 * --fit is the width it has over the width it wants, and it multiplies the
 * step the name is set in. Every name that fits is left at 1, so the scale
 * still sets the size and the shrink is only ever the last resort.
 */
function fitLine(node) {
  node.style.setProperty('--fit', '1');
  const room = node.getBoundingClientRect().width;
  if (room <= 0) return;
  const want = () => {
    /* max-content is the width the line wants. it is put back in the same
       tick, so nothing is ever painted at it. */
    node.style.width = 'max-content';
    const need = node.getBoundingClientRect().width;
    node.style.width = '';
    return need;
  };
  const need = want();
  if (need <= room) return;
  const fit = room / need;
  node.style.setProperty('--fit', String(fit));
  /* type does not scale perfectly linearly, so a line of three names can
     still be a pixel or two over after one pass. one correction closes it. */
  const got = want();
  if (got > room) node.style.setProperty('--fit', String(fit * (room / got)));
}

/*
 * --shrink is lead over the size the name is actually painted at, and --fall
 * is the travel that puts the shrunk name on line three. Both are per layer,
 * because two names in the same slot can be fitted differently, and both are
 * measured, because the two orientations space the lines apart differently.
 * transform and opacity only — never animate font-size.
 */
function applyShrink() {
  const lead = scalePx('--t-lead');
  for (const parts of teamEls) {
    const line3 = parts.line3.getBoundingClientRect();
    for (const layer of layers(parts)) {
      /* a layer mid-walk is scaled, so its box is not a box to measure from */
      if (getComputedStyle(layer).transform !== 'none') continue;
      fitLine(layer);
      const size = parseFloat(getComputedStyle(layer).fontSize) || 0;
      const shrink = size > 0 ? Math.min(1, lead / size) : 0.45;
      layer.style.setProperty('--shrink', String(shrink));
      const box = layer.getBoundingClientRect();
      if (box.height > 0 && line3.height > 0) {
        const fall = line3.top - (box.top + box.height * (1 - shrink));
        layer.style.setProperty('--fall', `${Math.round(fall)}px`);
      }
    }
    fitLine(parts.subname);
    fitLine(parts.l3sub);
  }
}

function layers(parts) {
  return [...parts.hero.querySelectorAll('.layer')];
}

function restingLayer(parts) {
  const all = layers(parts);
  return all.find((node) => node.classList.contains('on')) || all[0];
}

function spareLayer(parts) {
  const all = layers(parts);
  const live = restingLayer(parts);
  return all.find((node) => node !== live) || all[1];
}

function setHero(node, name, arrow) {
  node.textContent = '';
  if (arrow) {
    const glyph = document.createElement('span');
    glyph.className = 'arrow';
    glyph.textContent = arrow;
    node.appendChild(glyph);
  }
  node.appendChild(document.createTextNode(name || ''));
  fitLine(node);
}

function nameNode(name, arrow, tone) {
  const nm = document.createElement('span');
  nm.className = tone ? `nm ${tone}` : 'nm';
  if (arrow) {
    const glyph = document.createElement('span');
    glyph.className = 'arrow';
    glyph.textContent = arrow;
    nm.appendChild(glyph);
  }
  nm.appendChild(document.createTextNode(name));
  return nm;
}

function fillNames(node, players, arrowOf, toneOf) {
  node.textContent = '';
  for (const player of players) {
    node.appendChild(nameNode(player.name, arrowOf(player), toneOf(player)));
  }
  fitLine(node);
}

/* the eyebrow agrees with the count and never changes inside a window */
function subEyebrow(parts, count) {
  parts.labSub.textContent = count === 0 ? COPY.subsNone : (count > 1 ? COPY.subs : COPY.sub);
}

function buildStrip(track, team, gone) {
  track.textContent = '';
  const order = team.order;
  const n = order.length;
  if (n === 0) return;
  let first = true;
  const emit = (text, struck) => {
    if (!first) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '·';
      track.appendChild(sep);
    }
    first = false;
    const item = document.createElement('span');
    item.className = struck ? 'gone' : 'name';
    item.textContent = text;
    track.appendChild(item);
  };
  const leading = gone.filter((entry) => !entry.after);
  for (const entry of leading) emit(entry.name, true);
  for (let i = 0; i < n; i += 1) {
    const player = order[(team.keeperIndex + i) % n];
    emit(player.name, false);
    for (const entry of gone) {
      if (entry.after === player.name) emit(entry.name, true);
    }
  }
}

function paintTeam(t, team, mode) {
  const parts = teamEls[t];
  /* from COPY and not from the setup, so a game restored under an older
     wording of the two teams still reads the way the screen reads now */
  parts.name.textContent = TEAM_NAMES[t];
  parts.lab.textContent = COPY.keeper;
  const gone = (state.game && state.game.gone[t]) || [];
  buildStrip(parts.track, team, gone);

  if (mode === 'window') {
    /* the name line holds whoever occupies the slot after the change, line
       three whoever is leaving it. the arrow describes the player. */
    subEyebrow(parts, team.nextSubs.length);
    const off = new Set(team.goingOff.map((p) => p.id));
    fillNames(
      parts.subname,
      team.nextSubs,
      (p) => (off.has(p.id) ? '\u2193' : ''),
      (p) => (off.has(p.id) ? 'off' : '')
    );
    fillNames(parts.l3sub, team.comingOn, () => '\u2191', () => 'on');
    return;
  }

  subEyebrow(parts, team.subs.length);
  fillNames(parts.subname, team.subs, () => '', () => '');
  parts.l3sub.textContent = '';
}

/* Everything at rest, with no motion of any kind. */
function paintRest(r) {
  r.teams.forEach((team, t) => {
    const parts = teamEls[t];
    paintTeam(t, team, 'rest');
    const live = restingLayer(parts);
    const spare = spareLayer(parts);
    spare.className = 'layer';
    spare.textContent = '';
    live.className = 'layer on';
    live.style.cssText = '';
    setHero(live, team.keeper ? team.keeper.name : '', '');
    parts.subname.classList.remove('swapping', 'go', 'fading');
    parts.l3sub.classList.remove('swapping', 'go', 'fading');
    parts.strip.classList.remove('gone-quiet');
    parts.strip.style.display = '';
  });
  /* the walk leaves its numbers on the layer and clearing the style above
     takes them with it, so rest is also where they are taken again */
  applyShrink();
}

/* ==================================================== the changeover */

let windowTimers = [];

function clearWindowTimers() {
  for (const id of windowTimers) window.clearTimeout(id);
  windowTimers = [];
}

function later(ms, fn) {
  windowTimers.push(window.setTimeout(fn, ms));
}

/*
 * The window is the last ten seconds of the shift. A warning beats a report.
 */
function openWindow(r, options) {
  /* only a window walked in on is shown arrived. reduced motion still runs the
     timeline — the css turns each step into a 200ms crossfade in place. */
  const late = !options.animate;
  clearWindowTimers();

  /* the loud sound first, then the names. a klaxon under a spoken name buries
     it, and the thing that makes anyone look up has to come before the thing
     they are meant to hear. */
  if (options.speak) {
    const wait = alarm();
    later(wait + VOICE_GAP_MS, () => announce(linesForChange(r)));
  }

  el.body.classList.add('call');
  el.body.style.setProperty('--ground-ms', '200ms');
  if (state.screen !== 'display') return;

  advanceDrift();

  /* stage both layers: the keeper now, and the keeper about to go in. the
     class and the style are cleared first, because setting the name is what
     measures the fit and clearing the style would throw it away. */
  r.teams.forEach((team, t) => {
    const parts = teamEls[t];
    const out = restingLayer(parts);
    const into = spareLayer(parts);
    out.className = 'layer on';
    out.style.cssText = '';
    setHero(out, team.keeper ? team.keeper.name : '', '\u2193');
    into.className = 'layer walk-in';
    into.style.cssText = '';
    setHero(into, team.nextKeeper ? team.nextKeeper.name : '', '\u2191');
    parts.hero.dataset.out = out === layers(parts)[0] ? '0' : '1';
  });

  /* the outgoing name is the one that travels, and the arrow it has just been
     given is part of the width the fall is measured from */
  applyShrink();

  const heroPair = (parts) => {
    const all = layers(parts);
    const first = parts.hero.dataset.out === '0';
    return { out: all[first ? 0 : 1], into: all[first ? 1 : 0] };
  };

  /* a window entered late — a jump, or a cold restore — is true, so it is
     shown, but it is shown arrived rather than arriving. */
  if (late) {
    r.teams.forEach((team, t) => {
      const parts = teamEls[t];
      const { out, into } = heroPair(parts);
      parts.root.classList.add('instant');
      out.classList.add('walk-out', 'landed');
      into.classList.add('go');
      paintTeam(t, team, 'window');
      parts.subname.classList.add('swapping', 'go');
      parts.l3sub.classList.add('swapping', 'go');
      parts.strip.classList.add('gone-quiet');
      parts.strip.style.display = 'none';
      void parts.root.offsetWidth;
      parts.root.classList.remove('instant');
    });
    return;
  }

  /* t 0 - 140  hold. the stillness is what makes the move read as a consequence */
  later(140, () => {
    r.teams.forEach((team, t) => {
      const parts = teamEls[t];
      const { out, into } = heroPair(parts);
      out.classList.add('walk-out');
      into.classList.add('go');
      parts.strip.classList.add('gone-quiet');
      later(180, () => { parts.strip.style.display = 'none'; });
      later(500, () => out.classList.add('landed'));
    });
  });

  /* t 200  the sub slot, at lead */
  later(200, () => {
    r.teams.forEach((team, t) => {
      const parts = teamEls[t];
      paintTeam(t, team, 'window');
      parts.subname.classList.add('swapping');
      parts.l3sub.classList.add('swapping');
      void parts.subname.offsetWidth;
      parts.subname.classList.add('go');
      parts.l3sub.classList.add('go');
    });
  });
}

/* t 10s = T. The change is now. No travel on the way back. */
function closeWindow(r) {
  clearWindowTimers();
  el.body.style.setProperty('--ground-ms', '300ms');
  el.body.classList.remove('call');
  if (state.screen !== 'display') {
    paintRest(r);
    return;
  }

  r.teams.forEach((team, t) => {
    const parts = teamEls[t];
    const all = layers(parts);
    const out = all.find((node) => node.classList.contains('walk-out'));
    const into = all.find((node) => node.classList.contains('walk-in'));

    if (into) {
      into.classList.add('settle', 'on');
      window.setTimeout(() => {
        into.className = 'layer on';
        into.style.cssText = '';
        setHero(into, team.keeper ? team.keeper.name : '', '');
      }, 260);
    }
    if (out) {
      out.classList.add('leaving');
      window.setTimeout(() => {
        out.className = 'layer';
        out.style.cssText = '';
        out.textContent = '';
      }, 260);
    }
    if (!into && !out) {
      const live = restingLayer(parts);
      setHero(live, team.keeper ? team.keeper.name : '', '');
      live.className = 'layer on';
    }

    parts.subname.classList.add('fading');
    parts.l3sub.classList.add('fading');
    window.setTimeout(() => {
      subEyebrow(parts, team.subs.length);
      fillNames(parts.subname, team.subs, () => '', () => '');
      parts.l3sub.textContent = '';
      parts.subname.classList.remove('swapping', 'go', 'fading');
      parts.l3sub.classList.remove('swapping', 'go', 'fading');
    }, 250);

    buildStrip(parts.track, team, (state.game && state.game.gone[t]) || []);
    parts.strip.style.display = '';
    parts.strip.classList.add('gone-quiet');
    requestAnimationFrame(() => parts.strip.classList.remove('gone-quiet'));
  });
}

/* ================================================================ epochs */

function liveEpoch(elapsed) {
  const epochs = state.game.epochs;
  let live = epochs[0];
  for (const epoch of epochs) if (elapsed >= epoch.fromMs) live = epoch;
  return live;
}

function pendingEpoch(elapsed) {
  return state.game.epochs.find((epoch) => epoch.fromMs > elapsed) || null;
}

function view(elapsed) {
  const epoch = liveEpoch(elapsed);
  const r = rotation(epoch.setup, Math.max(0, elapsed - epoch.fromMs));
  return { epoch, r, k: epoch.index0 + r.changeIndex };
}

function prune(elapsed) {
  const epochs = state.game.epochs;
  while (epochs.length > 1 && elapsed >= epochs[1].fromMs) epochs.shift();
}

/* ================================================================= clock */

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setClock(text, pop) {
  if (text === state.clockText) return;
  state.clockText = text;
  el.clock.textContent = text;
  if (!pop || prefersReducedMotion()) return;
  el.clock.classList.remove('pop');
  void el.clock.offsetWidth;
  el.clock.classList.add('pop');
}

function setNotes() {
  const lines = [];
  if (state.pendingEdit) lines.push(COPY.pending);
  if (state.degradedVoice && !state.muted) lines.push(COPY.noVoice);
  if (state.degradedLock) lines.push(COPY.noLock);
  const text = lines.join(' · ');
  if (el.notes.textContent === text) return;
  el.notes.textContent = text;
}

/* ================================================================== tick */

let rafId = 0;
let intervalId = 0;

function tick() {
  /* the kick-off countdown runs before there is a game to count from */
  if (state.screen === 'countdown') {
    runCountdown();
    return;
  }
  if (!state.game) return;
  const elapsed = elapsedMs();
  prune(elapsed);
  const { r, k } = view(elapsed);
  const inWindow = r.msToNextChange <= WINDOW_MS;

  /* the crossing, not the tick */
  if (k !== state.shownChange) {
    const stepped = state.shownChange !== null && k - state.shownChange === 1;
    if (state.windowFor === k && stepped) {
      closeWindow(r);
    } else {
      clearWindowTimers();
      el.body.classList.remove('call');
      if (state.screen === 'display') paintRest(r);
    }
    state.shownChange = k;
    state.windowFor = null;
    if (state.pendingEdit && !pendingEpoch(elapsed)) state.pendingEdit = false;
    if (state.screen === 'setup' && draft.mode === 'edit') refreshEditList();
  }

  if (inWindow && state.windowFor !== k + 1) {
    state.windowFor = k + 1;
    /* a window entered late was missed, not announced. everything else is a
       real warning and must be spoken. */
    const late = r.msToNextChange < WINDOW_MS - 900;
    openWindow(r, { animate: !late, speak: !late });
  }

  if (state.screen === 'setup') {
    el.liveClock.textContent = formatCountdown(r.msToNextChange);
    return;
  }
  if (state.screen !== 'display') return;

  if (inWindow) setClock(String(Math.max(1, Math.ceil(r.msToNextChange / 1000))), false);
  else setClock(formatCountdown(r.msToNextChange), false);

  setNotes();
}

function loop() {
  tick();
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  if (!rafId) rafId = requestAnimationFrame(loop);
  if (!intervalId) intervalId = window.setInterval(tick, 250);
}

/* there is no clock to read on the setup screen with no game behind it */
function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  if (intervalId) window.clearInterval(intervalId);
  rafId = 0;
  intervalId = 0;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  resumeAudio();
  tick();
  takeWakeLock();
});

window.addEventListener('resize', () => {
  applyShrink();
});

/* ============================================================= kick off */

function showSetup() {
  state.screen = 'setup';
  el.setup.hidden = false;
  el.display.hidden = true;
  el.body.classList.remove('call');
  renderSetup();
}

function showDisplay() {
  state.screen = 'display';
  el.setup.hidden = true;
  el.display.hidden = false;
  el.edit.hidden = false;
  takeWakeLock();
}

function buildKickOffSetup() {
  let setup = draftSetup();
  for (let t = 0; t < 2; t += 1) {
    if (draft.keeper[t] == null) continue;
    setup = setStartKeeper(setup, t, draft.keeper[t]);
  }
  if (debug) {
    for (let t = 0; t < 2; t += 1) {
      const forced = debug.keepers[t];
      if (Number.isFinite(forced)) setup = setStartKeeper(setup, t, forced);
    }
  }
  /* the one impure moment: the first keeper is drawn, once, and written down */
  return drawKeepers(setup);
}

function saveSquad() {
  if (debug) return;
  writeJSON(KEY_SQUAD, {
    gameType: draft.gameType,
    gameMinutes: draft.gameMinutes,
    rotations: draft.rotations,
    names: draft.names
  });
}

/* empties both lists and forgets the remembered squad. Never mid-game: the
   button is hidden then, so this cannot cost a running rota. */
el.clear.addEventListener('click', () => {
  if (draft.mode === 'edit') return;
  draft.names = [[], []];
  draft.keeper = [null, null];
  if (!debug) dropKey(KEY_SQUAD);
  renderSetup();
  el.inputs[0].focus();
});

el.start.addEventListener('click', () => {
  const sizes = draft.names.map((names) => names.length);
  if (sizes.some((n) => n < 2)) {
    const shortest = sizes[0] <= sizes[1] ? 0 : 1;
    el.inputs[shortest].focus();
    renderSetup();
    return;
  }
  /* the gesture iOS needs, for both the audio context and the voice */
  markGesture();
  unlockVoice();
  saveSquad();
  beginKickOff();
});

function beginKickOff() {
  const setup = buildKickOffSetup();
  state.pendingSetup = setup;
  driftStep = 0;
  applyDrift();

  const r = rotation(setup, 0);
  el.setup.hidden = true;
  el.display.hidden = false;
  el.edit.hidden = true;
  el.body.classList.remove('call');
  paintRest(r);
  el.notes.textContent = '';

  if (debug && !debug.countdown) {
    finishKickOff();
    return;
  }
  state.screen = 'countdown';
  state.countdownAt = Date.now();
  state.countdownLeft = COUNTDOWN_S + 1;
  takeWakeLock();
  startLoop();
  runCountdown();
}

function runCountdown() {
  const gone = Date.now() - state.countdownAt;
  const left = COUNTDOWN_S - Math.floor(gone / 1000);
  if (left <= 0) {
    finishKickOff();
    return;
  }
  if (left === state.countdownLeft) return;
  state.countdownLeft = left;
  setClock(String(left), true);
  if (left <= 5) tick880();
}

function abortKickOff() {
  if (state.screen !== 'countdown') return;
  el.edit.hidden = false;
  state.screen = 'setup';
  state.pendingSetup = null;
  state.clockText = '';
  el.display.hidden = true;
  el.setup.hidden = false;
  renderSetup();
}

function finishKickOff() {
  const setup = state.pendingSetup;
  state.pendingSetup = null;
  state.game = {
    kickoff: nowMs() - (debug ? debug.offsetMs : 0),
    epochs: [{ fromMs: 0, index0: 0, setup }],
    gone: [[], []]
  };
  state.shownChange = null;
  state.windowFor = null;
  state.pendingEdit = false;
  state.clockText = '';
  showDisplay();
  saveGame();

  const wait = alarm();
  el.body.style.setProperty('--ground-ms', '500ms');
  el.body.classList.add('call');
  window.setTimeout(() => {
    /* a kick-off straight into a change window must not take its ground back */
    if (!state.windowFor) el.body.classList.remove('call');
    el.body.style.setProperty('--ground-ms', '200ms');
  }, 220);

  const r = rotation(setup, Math.max(0, elapsedMs()));
  /* the same order as a changeover: the alarm finishes, then the names */
  window.setTimeout(() => announce(linesForKickOff(r)), wait + VOICE_GAP_MS);

  startLoop();
  tick();
}

/* =========================================================== edit route */

/*
 * The pencil returns to the setup screen with the game still running. The list
 * is the ring rotated so the next change is what the screen describes, so the
 * anchor an edit writes has exactly the same shape as the one kick-off writes.
 */

function subPointerAt(team, changeIndex, n, gameType) {
  const anchor = team.anchor;
  if (anchor && Number.isFinite(Number(anchor.subIndex))) {
    const step = changeIndex - Math.floor(Number(anchor.changeIndex) || 0);
    return mod(Math.floor(Number(anchor.subIndex)) + step, n);
  }
  return mod(gameType + changeIndex, n);
}

function openEdit() {
  if (!state.game) return;
  const elapsed = elapsedMs();
  prune(elapsed);
  const { epoch, r, k } = view(elapsed);
  const pending = pendingEpoch(elapsed);

  const live = pending ? pending.setup : epoch.setup;
  draft.gameType = gameTypeOf(live);
  draft.gameMinutes = onGrid('time', Math.round(live.gameMinutes));
  draft.rotations = onGrid('rotations', rotationsOf(live));
  /* the interval the kick-off froze, with the settings it came from beside it */
  draft.frozen = Number.isFinite(Number(live.intervalMs)) ? {
    intervalMs: Number(live.intervalMs),
    rotations: draft.rotations,
    gameMinutes: draft.gameMinutes
  } : null;
  draft.mode = 'edit';
  draft.signature = '';
  draft.baseChange = k;
  draft.names = [[], []];
  draft.keeper = [null, null];

  for (let t = 0; t < 2; t += 1) {
    if (pending) {
      const team = pending.setup.teams[t];
      draft.names[t] = team.players.map((p) => p.name);
      draft.keeper[t] = team.anchor ? team.anchor.keeperIndex : null;
      continue;
    }
    const team = r.teams[t];
    const n = team.order.length;
    if (n === 0) continue;
    const g = draft.gameType;
    const raw = epoch.setup.teams[t];
    let rot;
    let marker;
    if (n >= g) {
      const sIdx = subPointerAt(raw, r.changeIndex, n, g);
      rot = mod(sIdx + 1 - g, n);
      marker = mod(team.keeperIndex + 1 - rot, n);
    } else {
      const legal = legalStartKeepers(epoch.setup, t);
      marker = legal.length > 0 ? legal[0] : 0;
      rot = mod(team.keeperIndex + 1 - marker, n);
    }
    draft.names[t] = [];
    for (let i = 0; i < n; i += 1) draft.names[t].push(team.order[mod(rot + i, n)].name);
    draft.keeper[t] = marker;
  }

  state.screen = 'setup';
  el.display.hidden = true;
  el.setup.hidden = false;
  renderSetup();
  for (let t = 0; t < 2; t += 1) reseatKeeper(t);
  renderSetup();
  /* the signature is taken after the reseat, so opening the screen and closing
     it again can never read as an edit */
  draft.signature = draftSignature();
  renderSetup();
  const first = view(elapsedMs());
  el.liveClock.textContent = formatCountdown(first.r.msToNextChange);
}

/*
 * A change fires while setup is open. The list is the picture of the next
 * change, so it has to be rebuilt — but never under a person's hands. A
 * half-typed name, a live drag or an edit already made all hold it back.
 */
function refreshEditList() {
  if (drag) return;
  if (draft.signature === '' || draftSignature() !== draft.signature) return;
  if (el.inputs.some((input) => input.value.trim() !== '')) return;
  openEdit();
}

function commitEdit() {
  const elapsed = elapsedMs();
  const { epoch, r, k } = view(elapsed);
  const changed = draftSignature() !== draft.signature;

  if (changed) {
    const setup = buildEditSetup(k);
    if (setup) {
      const boundary = epoch.fromMs + (r.changeIndex + 1) * r.intervalMs;
      const epochs = state.game.epochs.filter((one) => one.fromMs <= elapsed);
      epochs.push({ fromMs: boundary, index0: k + 1, setup });
      state.game.epochs = epochs;
      state.pendingEdit = true;
      recordGone(setup);
      saveGame();
      saveSquad();
    }  }

  draft.mode = 'pre';
  draft.signature = '';
  draft.frozen = null;
  state.screen = 'display';
  el.setup.hidden = true;
  el.display.hidden = false;
  el.edit.hidden = false;
  clearWindowTimers();
  const after = view(elapsedMs());
  state.shownChange = after.k;
  if (after.r.msToNextChange <= WINDOW_MS) {
    state.windowFor = after.k + 1;
    paintRest(after.r);
    openWindow(after.r, { animate: false, speak: false });
  } else {
    state.windowFor = null;
    el.body.classList.remove('call');
    paintRest(after.r);
  }
  setNotes();
  takeWakeLock();
}

function buildEditSetup(k) {
  const sizes = draft.names.map((names) => names.length);
  if (sizes.some((n) => n < 1)) return null;
  let setup = draftSetup();
  const step = Math.max(0, k - draft.baseChange);
  for (let t = 0; t < 2; t += 1) {
    const n = draft.names[t].length;
    if (n === 0) continue;
    const wanted = draft.keeper[t] == null ? 0 : draft.keeper[t];
    setup = setStartKeeper(setup, t, wanted);
    const anchor = setup.teams[t].anchor;
    if (anchor && step > 0) {
      /* both pointers move together, so the offset — and the two rules — hold */
      anchor.keeperIndex = mod(anchor.keeperIndex + step, n);
      anchor.subIndex = mod(anchor.subIndex + step, n);
    }
  }
  return setup;
}

/* Names that have left keep their place in the strip, struck through. */
function recordGone(next) {
  const epochs = state.game.epochs;
  const previous = epochs.length > 1 ? epochs[epochs.length - 2].setup : null;
  if (!previous) return;
  for (let t = 0; t < 2; t += 1) {
    const was = previous.teams[t].players.map((p) => p.name);
    const now = new Set(next.teams[t].players.map((p) => p.name));
    const live = new Set(now);
    was.forEach((name, i) => {
      if (live.has(name)) return;
      let after = null;
      for (let j = i - 1; j >= 0; j -= 1) {
        if (now.has(was[j])) { after = was[j]; break; }
      }
      const already = state.game.gone[t].some((entry) => entry.name === name && entry.after === after);
      if (!already) state.game.gone[t].push({ name, after });
    });
    state.game.gone[t] = state.game.gone[t].filter((entry) => !now.has(entry.name));
  }
}

el.edit.addEventListener('click', (event) => {
  event.stopPropagation();
  if (state.screen === 'countdown') { abortKickOff(); return; }
  openEdit();
});

/*
 * The whole bar is the way back, so there is nothing small to hit with a cold
 * thumb and no x to look for. The mute sits inside it and stops its own click.
 */
el.livebar.addEventListener('click', commitEdit);
el.livebar.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  commitEdit();
});

/* =========================================================== going home */

/*
 * The way back out of a game and into a new one. It is the only control in
 * the app that undoes something, so it is the only one that asks a question
 * first: a game is a kick-off time and nothing else remembers it, and the
 * clock does not stop while the question is on the screen.
 */

function openConfirm() {
  el.confirm.hidden = false;
  el.confirmNo.focus();
}

function closeConfirm() {
  el.confirm.hidden = true;
}

function goHome() {
  closeConfirm();
  clearWindowTimers();
  stopLoop();
  announceToken += 1;
  try { speechSynthesis.cancel(); } catch (error) { /* ignore */ }

  /* the game goes first, so the lock's own release handler does not read the
     let-go as a screen that failed to stay awake */
  state.game = null;
  releaseWakeLock();
  state.shownChange = null;
  state.windowFor = null;
  state.pendingEdit = false;
  state.degradedLock = false;
  state.clockText = '';
  dropKey(KEY_GAME);

  draft.mode = 'pre';
  draft.signature = '';
  draft.frozen = null;
  draft.keeper = [null, null];
  /* the setup screen comes back the way a cold boot leaves it: the squad from
     last time, ready to be a new game */
  loadSquadIntoDraft(debug ? null : readJSON(KEY_SQUAD));
  showSetup();
}

el.home.addEventListener('click', (event) => {
  event.stopPropagation();
  if (state.screen === 'countdown') { abortKickOff(); return; }
  if (!state.game) return;
  openConfirm();
});

el.confirmYes.addEventListener('click', goHome);
el.confirmNo.addEventListener('click', closeConfirm);

/* a tap on the display re-takes the lock and re-tests the voice, no label */
el.display.addEventListener('click', () => {
  if (state.screen === 'countdown') { abortKickOff(); return; }
  markGesture();
  takeWakeLock();
  if (state.degradedVoice) unlockVoice();
});

/* any first touch, anywhere, is enough to bring a restored game back to life */
document.addEventListener('pointerdown', () => {
  if (gestured) return;
  markGesture();
  if (state.game && state.degradedVoice) unlockVoice();
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

function onGrid(key, value) {
  const picker = PICKERS[key];
  const steps = Math.round((value - picker.min) / picker.step);
  const snapped = picker.min + steps * picker.step;
  return Math.min(picker.max, Math.max(picker.min, snapped));
}

function loadSquadIntoDraft(squad) {
  if (!squad || !Array.isArray(squad.names)) return;
  const names = [0, 1].map((t) => (Array.isArray(squad.names[t]) ? squad.names[t].slice() : []));
  if (names[0].length === 0 && names[1].length === 0) return;
  draft.names = names;
  /* a squad stored under an older range has to land on the picker's grid */
  if (Number.isFinite(squad.gameType)) draft.gameType = onGrid('type', squad.gameType);
  if (Number.isFinite(squad.gameMinutes)) draft.gameMinutes = onGrid('time', squad.gameMinutes);
  if (Number.isFinite(squad.rotations)) draft.rotations = onGrid('rotations', squad.rotations);
  /* a squad saved by the build that had the manual override carries an
     `intervalMode` and a `subMinutes`. Both are read and ignored. */
}

function restoreGame() {
  const game = readJSON(KEY_GAME);
  if (!game || !Number.isFinite(game.kickoff) || !Array.isArray(game.epochs)) return false;
  if (game.epochs.length === 0 || !game.epochs[0].setup) return false;
  const elapsed = Date.now() - game.kickoff;
  const setup = game.epochs[0].setup;
  const limit = (Number(setup.gameMinutes) || DEFAULT_GAME_MINUTES) * MS_PER_MINUTE + 60 * MS_PER_MINUTE;
  if (elapsed < 0 || elapsed > limit) {
    dropKey(KEY_GAME);
    return false;
  }
  state.game = {
    kickoff: game.kickoff,
    epochs: game.epochs,
    gone: Array.isArray(game.gone) ? game.gone : [[], []]
  };
  if (debug) state.game.kickoff = nowMs() - debug.offsetMs;

  const now = elapsedMs();
  prune(now);
  const { r, k } = view(now);
  applyDrift();
  /* no dialog, and no voice for changes missed while the phone was dead */
  state.shownChange = k;
  state.pendingEdit = Boolean(pendingEpoch(now));
  showDisplay();
  paintRest(r);
  if (r.msToNextChange <= WINDOW_MS) {
    state.windowFor = k + 1;
    openWindow(r, { animate: false, speak: false });
  }
  startLoop();
  tick();
  return true;
}

/* ============================================================== debug */

if (debug) {
  window.rota = {
    state,
    draft,
    rotation,
    view: () => view(elapsedMs()),
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
    kickOff: () => el.start.click(),
    tick
  };
}

/* =============================================================== boot */

function boot() {
  if (debug) {
    if (Number.isFinite(debug.gameType)) draft.gameType = debug.gameType;
    if (Number.isFinite(debug.gameMinutes)) draft.gameMinutes = debug.gameMinutes;
    if (Number.isFinite(debug.rotations)) draft.rotations = debug.rotations;
    for (let t = 0; t < 2; t += 1) {
      if (debug.squads[t]) draft.names[t] = debug.squads[t].slice(0, 24);
    }
  }
  loadSquadIntoDraft(debug ? null : readJSON(KEY_SQUAD));
  if (!restoreGame()) showSetup();
  el.body.classList.remove('boot');
  if (debug && debug.auto && !state.game) {
    window.setTimeout(() => el.start.click(), 0);
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
