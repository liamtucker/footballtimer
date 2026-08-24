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
  subCountFor,
  MIN_GAME_TYPE,
  MAX_GAME_TYPE,
  DEFAULT_GAME_TYPE,
  DEFAULT_SUB_MINUTES,
  DEFAULT_GAME_MINUTES,
  DEFAULT_TEAM_NAMES
} from './rotation.js';

const MS_PER_MINUTE = 60000;
const NAME_MAX = 10;
const WINDOW_MS = 10000;
const COUNTDOWN_S = 10;

/* Every string, lifted from brain/copy.md. */
const COPY = {
  teamA: 'Bibs',
  teamB: 'No bibs',
  addPlaceholder: 'Add a name',
  divider: 'Subs',
  keeperTag: 'Starts in goal',
  gameTimeLabel: 'Game time',
  changeLabel: 'Change every',
  start: 'Kick off',
  clear: 'Clear all',
  restored: 'Delete anyone missing.',
  editAria: 'Edit setup',
  keeper: 'in goal',
  sub: 'sub',
  subs: 'subs',
  subsNone: 'no subs',
  off: 'off',
  on: 'on',
  errorTooSmall: 'Two names minimum.',
  warnDuplicate: 'Same name twice. Add an initial.',
  /* not in copy.md — the two conditional lines and the chip need words */
  pending: 'Edits land at the next change',
  noVoice: 'No voice',
  noLock: 'Screen may sleep',
  chipLabel: 'Next change'
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
 *   &sub=10 &game=120         the two durations
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
  const rate = Math.max(0, Number(params.get('rate')) || 1);
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
    subMinutes: int('sub'),
    gameMinutes: int('game'),
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
  subMinutes: DEFAULT_SUB_MINUTES,
  names: [[], []],
  keeper: [null, null],
  mode: 'pre',        /* 'pre' before kick-off, 'edit' with a game running */
  baseChange: 0,      /* the change index the edit picture was built from */
  signature: ''
};

const state = {
  screen: 'setup',
  prefilled: false,
  game: null,         /* { kickoff, epochs: [...], gone: [[], []] } */
  shownChange: null,
  windowFor: null,
  countdownAt: 0,
  countdownLeft: 0,
  clockText: '',
  clockCount: false,
  elapsedText: '',
  pendingEdit: false,
  degradedVoice: false,
  degradedLock: false,
  len: 5
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
  typeValue: $('type-value'),
  typeSelect: $('type-select'),
  gameValue: $('game-value'),
  gameSelect: $('game-select'),
  subValue: $('sub-value'),
  subSelect: $('sub-select'),
  restored: $('restored'),
  clear: $('clear'),
  notice: $('notice'),
  start: $('start'),
  chip: $('chip'),
  chipCount: $('chip-count'),
  clock: $('clock'),
  elapsed: $('elapsed'),
  notes: $('notes'),
  edit: $('edit')
};

const teamEls = [0, 1].map((t) => {
  const root = el.display.querySelector(`.team[data-team="${t}"]`);
  return {
    root,
    tag: root.querySelector('.tag'),
    subgroup: root.querySelector('.subgroup'),
    lab: root.querySelector('.lab'),
    hero: root.querySelector('.hero'),
    line3: root.querySelector('.line3'),
    strip: root.querySelector('.strip'),
    track: root.querySelector('.strip-track')
  };
});

/* ================================================================ sound */

/*
 * Two sounds, two meanings, never swapped. A whistle says the change is now.
 * A chime says names follow. Both are synthesised — no files, no network.
 * The context is created inside the Kick off gesture so iOS unlocks it.
 */

let ac = null;
let noise = null;
let gestured = false;

/*
 * The context is created inside a gesture and never before. A game restored
 * after a reload has had no gesture yet, so it makes no sound and says so on
 * the degraded line — and the first touch anywhere brings it back.
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

function noiseBuffer(ctx) {
  if (noise) return noise;
  const frames = Math.floor(ctx.sampleRate * 1.2);
  noise = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  return noise;
}

/*
 * A referee whistle. The body is band-passed noise around 3.4kHz — that is the
 * air, and it is what stops it sounding like a beep. Two detuned sawtooths at
 * 2350 and 2570 sit under it for the pitch, and an 18Hz tremolo on the whole
 * thing is the pea rattling.
 */
function whistle(ms) {
  const ctx = audio();
  if (!ctx) return;
  resumeAudio();
  const dur = Math.max(0.12, (ms || 700) / 1000);
  const attack = Math.min(0.04, dur * 0.16);
  const release = Math.min(0.25, dur * 0.42);
  const t = ctx.currentTime + 0.01;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(0.9, t + attack);
  out.gain.setValueAtTime(0.9, t + Math.max(attack, dur - release));
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(ctx.destination);

  const trem = ctx.createGain();
  trem.gain.setValueAtTime(0.74, t);
  trem.connect(out);
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(18, t);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0.26, t);
  lfo.connect(lfoGain).connect(trem.gain);
  lfo.start(t);
  lfo.stop(t + dur);

  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx);
  air.loop = true;
  const bp1 = ctx.createBiquadFilter();
  bp1.type = 'bandpass';
  bp1.frequency.setValueAtTime(3400, t);
  bp1.Q.setValueAtTime(7, t);
  const bp2 = ctx.createBiquadFilter();
  bp2.type = 'bandpass';
  bp2.frequency.setValueAtTime(3400, t);
  bp2.Q.setValueAtTime(7, t);
  /* the band breathes with the pea, so the air is part of the rattle */
  const airWobble = ctx.createOscillator();
  airWobble.type = 'sine';
  airWobble.frequency.setValueAtTime(18, t);
  const airWobbleGain = ctx.createGain();
  airWobbleGain.gain.setValueAtTime(190, t);
  airWobble.connect(airWobbleGain);
  airWobbleGain.connect(bp1.frequency);
  airWobbleGain.connect(bp2.frequency);
  airWobble.start(t);
  airWobble.stop(t + dur);
  const airGain = ctx.createGain();
  airGain.gain.setValueAtTime(1.1, t);
  air.connect(bp1).connect(bp2).connect(airGain).connect(trem);
  air.start(t);
  air.stop(t + dur);

  for (const [freq, gain] of [[2350, 0.15], [2570, 0.114]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.94, t);
    osc.frequency.linearRampToValueAtTime(freq, t + attack);
    const warble = ctx.createOscillator();
    warble.type = 'sine';
    warble.frequency.setValueAtTime(18, t);
    const warbleGain = ctx.createGain();
    warbleGain.gain.setValueAtTime(freq * 0.014, t);
    warble.connect(warbleGain).connect(osc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(7200, t);
    const og = ctx.createGain();
    og.gain.setValueAtTime(gain, t);
    osc.connect(lp).connect(og).connect(trem);
    osc.start(t);
    osc.stop(t + dur);
    warble.start(t);
    warble.stop(t + dur);
  }
}

function tone(ctx, freq, at, dur, level) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(level, at + 0.02);
  g.gain.setValueAtTime(level, at + Math.max(0.03, dur - 0.05));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(ctx.destination);
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

/* 660 then 880, 120ms each, 200ms apart. The same tone every time. */
function chime() {
  const ctx = audio();
  if (!ctx) return 0;
  resumeAudio();
  const t = ctx.currentTime + 0.01;
  tone(ctx, 660, t, 0.12, 0.5);
  tone(ctx, 880, t + 0.2, 0.12, 0.5);
  return 330;
}

function tick880() {
  const ctx = audio();
  if (!ctx) return;
  resumeAudio();
  const t = ctx.currentTime + 0.005;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.08, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  g.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.04);
}

/* ================================================================ voice */

let chosenVoice = null;
let voiceReady = false;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
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

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

/* iOS needs a gesture before it will speak. The Kick off tap is that gesture. */
function unlockVoice() {
  if (!('speechSynthesis' in window)) {
    state.degradedVoice = true;
    return;
  }
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(' ');
    utterance.volume = 0;
    let started = false;
    utterance.onstart = () => {
      started = true;
      voiceReady = true;
      state.degradedVoice = false;
    };
    utterance.onerror = () => { state.degradedVoice = true; };
    speechSynthesis.speak(utterance);
    state.degradedVoice = false;
    /* the probe unlocks, it does not diagnose. a silent volume-0 utterance is
       reported inconsistently across engines, and a false `no voice` line on a
       working phone is worse than no line at all. a real speak() that fails is
       what marks the voice lost. */
    void started;
  } catch (error) {
    state.degradedVoice = true;
  }
}

function speak(text, onEnd) {
  if (!('speechSynthesis' in window)) {
    state.degradedVoice = true;
    if (onEnd) onEnd();
    return;
  }
  try {
    /* iOS drops the queue when the page is backgrounded and leaves the engine
       stuck. cancel() before every speak() is the only reliable reset — but
       Chrome processes the cancel asynchronously and takes out an utterance
       queued in the same tick with it, so the speak has to wait a beat. */
    speechSynthesis.cancel();
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
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (onEnd) onEnd();
    };
    utterance.onstart = () => {
      voiceReady = true;
      state.degradedVoice = false;
    };
    utterance.onend = finish;
    utterance.onerror = (event) => {
      /* a cancel is our own doing, not a lost voice */
      const reason = event && event.error;
      if (reason !== 'canceled' && reason !== 'interrupted') state.degradedVoice = true;
      finish();
    };
    window.setTimeout(() => {
      if (done) return;
      speechSynthesis.speak(utterance);
    }, 45);
    /* a voice that never starts must not swallow the second team */
    window.setTimeout(() => {
      if (done) return;
      if (!speechSynthesis.speaking && !speechSynthesis.pending) {
        state.degradedVoice = true;
        finish();
      }
    }, 1700);
    /* nor may one that never ends. iOS leaves the engine stuck often enough
       that `end` cannot be the only way out, and the whole announcement has
       to fit inside the ten seconds. the cap is well past a real reading. */
    window.setTimeout(finish, Math.min(4200, 1200 + text.length * 100));
  } catch (error) {
    state.degradedVoice = true;
    if (onEnd) onEnd();
  }
}

function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/* [chime] Bibs. Chris in goal. Mo off.  —  the chime sounds before each team */
function linesForChange(r) {
  const lines = [];
  for (const team of r.teams) {
    if (!team.nextKeeper) continue;
    const bits = [`${team.name}.`, `${team.nextKeeper.name} in goal.`];
    const off = team.goingOff.map((p) => p.name);
    if (off.length > 0) bits.push(`${joinNames(off)} off.`);
    lines.push(bits.join(' '));
  }
  return lines;
}

/* [chime] Bibs. Chris in goal. Sub, Dave. — nobody comes off at kick-off */
function linesForKickOff(r) {
  const lines = [];
  for (const team of r.teams) {
    if (!team.keeper) continue;
    const bits = [`${team.name}.`, `${team.keeper.name} in goal.`];
    const subs = team.subs.map((p) => p.name);
    if (subs.length > 0) {
      bits.push(`${subs.length > 1 ? 'Subs' : 'Sub'}, ${joinNames(subs)}.`);
    }
    lines.push(bits.join(' '));
  }
  return lines;
}

let announceToken = 0;

function announce(lines) {
  announceToken += 1;
  const token = announceToken;
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

/* ========================================================= setup screen */

function draftSetup() {
  return createSetup({
    gameType: draft.gameType,
    subMinutes: draft.subMinutes,
    gameMinutes: draft.gameMinutes,
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
    s: draft.subMinutes,
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
  if (isKeeper) {
    const tag = document.createElement('span');
    tag.className = 'keeper-tag';
    tag.textContent = COPY.keeperTag;
    label.appendChild(tag);
  }
  const text = document.createElement('span');
  text.textContent = name;
  label.appendChild(text);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'row-x';
  remove.innerHTML = xIcon();
  remove.setAttribute('aria-label', 'remove');

  row.appendChild(label);
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

function durationWords(minutes) {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} min`;
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

  el.typeValue.textContent = `${draft.gameType} a side`;
  el.typeSelect.value = String(draft.gameType);
  el.gameValue.textContent = durationWords(draft.gameMinutes);
  el.gameSelect.value = String(draft.gameMinutes);
  el.subValue.textContent = `${draft.subMinutes} min`;
  el.subSelect.value = String(draft.subMinutes);

  const sizes = draft.names.map((names) => names.length);
  const valid = sizes.every((n) => n >= 2);
  const anyTyped = sizes.some((n) => n > 0);
  const duplicate = draft.names.some(duplicateIn);

  let notice = '';
  if (!valid && anyTyped) notice = COPY.errorTooSmall;
  else if (duplicate) notice = COPY.warnDuplicate;
  el.notice.textContent = notice;
  el.notice.hidden = notice === '';

  const editing = draft.mode === 'edit';
  el.start.hidden = editing;
  el.chip.hidden = !editing;
  el.start.classList.toggle('hairline', !valid);
  el.restored.hidden = editing || !state.prefilled;
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
  state.prefilled = false;
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
  state.prefilled = false;
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
    if (commit) chooseKeeper(current.teamIndex, current.index);
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

/* ------------------------------------------------------------ settings */

function fillSelect(select, values, label) {
  select.textContent = '';
  for (const value of values) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = label(value);
    select.appendChild(option);
  }
}

const TYPE_VALUES = [];
for (let n = MIN_GAME_TYPE; n <= MAX_GAME_TYPE; n += 1) TYPE_VALUES.push(n);
const GAME_VALUES = [45, 60, 75, 90, 105, 120, 150, 180];
const SUB_VALUES = [3, 4, 5, 6, 7, 8, 10, 12, 15, 20];

fillSelect(el.typeSelect, TYPE_VALUES, (n) => `${n} a side`);
fillSelect(el.gameSelect, GAME_VALUES, durationWords);
fillSelect(el.subSelect, SUB_VALUES, (n) => `${n} min`);

el.typeSelect.addEventListener('change', () => {
  draft.gameType = Number(el.typeSelect.value) || DEFAULT_GAME_TYPE;
  renderSetup();
  for (let t = 0; t < 2; t += 1) reseatKeeper(t);
  renderSetup();
});
el.gameSelect.addEventListener('change', () => {
  draft.gameMinutes = Number(el.gameSelect.value) || DEFAULT_GAME_MINUTES;
  renderSetup();
});
el.subSelect.addEventListener('change', () => {
  draft.subMinutes = Number(el.subSelect.value) || DEFAULT_SUB_MINUTES;
  renderSetup();
});

el.clear.addEventListener('click', () => {
  draft.names = [[], []];
  draft.keeper = [null, null];
  state.prefilled = false;
  dropKey(KEY_SQUAD);
  renderSetup();
});

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

function applyNameLength(setup) {
  let longest = 5;
  for (const team of setup.teams) {
    for (const player of team.players) longest = Math.max(longest, player.name.length);
  }
  if (longest === state.len) return;
  state.len = longest;
  document.documentElement.style.setProperty('--len', String(longest));
}

/*
 * --shrink is --t-name-2 over the live hero size and --fall is the travel that
 * puts the shrunk name on line 3. Both are measured, because the hero size
 * moves with the longest name and the two orientations space the lines apart
 * differently. transform and opacity only — never animate font-size.
 */
function applyShrink() {
  /* only measure while every layer is at rest and untransformed */
  if (teamEls.some((parts) => parts.hero.querySelector('.walk-out, .walk-in'))) return;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const name2 = (isPortrait() ? 1.5 : 1.75) * rem;
  for (const parts of teamEls) {
    const layer = parts.hero.querySelector('.layer');
    const hero = parseFloat(getComputedStyle(layer).fontSize) || name2;
    const shrink = Math.min(1, name2 / hero);
    parts.root.style.setProperty('--shrink', String(shrink));
    const box = layer.getBoundingClientRect();
    const line3 = parts.line3.getBoundingClientRect();
    if (box.height > 0 && line3.height > 0) {
      const fall = line3.top - (box.top + box.height * (1 - shrink));
      parts.root.style.setProperty('--fall', `${Math.round(fall)}px`);
    }
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
}

function pairNode(label, name, arrow, cls) {
  const wrap = document.createElement('span');
  wrap.className = `pair ${cls}`;
  const lab = document.createElement('span');
  lab.className = 'plab';
  lab.textContent = label;
  const nm = document.createElement('span');
  nm.className = 'nm';
  if (arrow) {
    const glyph = document.createElement('span');
    glyph.className = 'arrow';
    glyph.textContent = arrow;
    nm.appendChild(glyph);
    nm.appendChild(document.createTextNode(' '));
  }
  nm.appendChild(document.createTextNode(name));
  wrap.appendChild(lab);
  wrap.appendChild(nm);
  return wrap;
}

function fillSubsRest(node, team) {
  node.textContent = '';
  node.hidden = false;
  if (team.subs.length === 0) {
    const none = document.createElement('span');
    none.className = 'none';
    none.textContent = COPY.subsNone;
    node.appendChild(none);
    return;
  }
  node.appendChild(pairNode(
    team.subs.length > 1 ? COPY.subs : COPY.sub,
    team.subs.map((p) => p.name).join('  '),
    '',
    'rest'
  ));
}

function fillSubsWindow(node, team) {
  node.textContent = '';
  /* a team with no subs shows `in goal CHRIS` alone */
  if (team.subs.length === 0 || team.goingOff.length === 0) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  node.appendChild(pairNode(COPY.off, team.goingOff.map((p) => p.name).join('  '), '↓', 'off'));
  node.appendChild(pairNode(COPY.on, team.comingOn.map((p) => p.name).join('  '), '↑', 'on'));
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
  parts.tag.textContent = team.name;
  parts.lab.textContent = COPY.keeper;
  const gone = (state.game && state.game.gone[t]) || [];

  if (mode === 'window') {
    fillSubsWindow(parts.subgroup, team);
    buildStrip(parts.track, team, gone);
    return;
  }
  fillSubsRest(parts.subgroup, team);
  buildStrip(parts.track, team, gone);
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
    parts.subgroup.classList.remove('swapping', 'go', 'fading');
    parts.strip.classList.remove('gone-quiet');
    parts.strip.style.display = '';
  });
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

  if (options.speak) announce(linesForChange(r));
  if (state.screen !== 'display') return;

  el.body.classList.add('call');
  el.body.style.setProperty('--ground-ms', '200ms');
  advanceDrift();
  applyShrink();

  /* stage both layers: the keeper now, and the keeper about to go in */
  r.teams.forEach((team, t) => {
    const parts = teamEls[t];
    const out = restingLayer(parts);
    const into = spareLayer(parts);
    setHero(out, team.keeper ? team.keeper.name : '', '\u2193');
    out.className = 'layer on';
    out.style.cssText = '';
    setHero(into, team.nextKeeper ? team.nextKeeper.name : '', '\u2191');
    into.className = 'layer walk-in';
    into.style.cssText = '';
    parts.hero.dataset.out = out === layers(parts)[0] ? '0' : '1';
  });

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
      parts.subgroup.classList.add('swapping', 'go');
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

  /* t 200  the sub slot, at --t-name-2 */
  later(200, () => {
    r.teams.forEach((team, t) => {
      const parts = teamEls[t];
      paintTeam(t, team, 'window');
      parts.subgroup.classList.add('swapping');
      void parts.subgroup.offsetWidth;
      parts.subgroup.classList.add('go');
    });
  });
}

/* t 10s = T. The change is now. No travel on the way back. */
function closeWindow(r) {
  clearWindowTimers();
  if (state.screen !== 'display') {
    paintRest(r);
    return;
  }
  el.body.style.setProperty('--ground-ms', '300ms');
  el.body.classList.remove('call');

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

    parts.subgroup.classList.add('fading');
    window.setTimeout(() => {
      fillSubsRest(parts.subgroup, team);
      parts.subgroup.classList.remove('swapping', 'go', 'fading');
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

function formatPlayed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function setClock(text, count, pop) {
  if (text === state.clockText && count === state.clockCount) return;
  state.clockText = text;
  state.clockCount = count;
  el.clock.textContent = text;
  el.clock.classList.toggle('count', count);
  if (!pop || prefersReducedMotion()) return;
  el.clock.classList.remove('pop');
  void el.clock.offsetWidth;
  el.clock.classList.add('pop');
}

function setNotes() {
  const lines = [];
  if (state.pendingEdit) lines.push(COPY.pending);
  if (state.degradedVoice) lines.push(COPY.noVoice);
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
  }

  if (inWindow && state.windowFor !== k + 1) {
    state.windowFor = k + 1;
    /* a window entered late was missed, not announced. everything else is a
       real warning and must be spoken. */
    const late = r.msToNextChange < WINDOW_MS - 900;
    openWindow(r, { animate: !late, speak: !late });
  }

  if (state.screen === 'setup') {
    el.chipCount.textContent = formatCountdown(r.msToNextChange);
    return;
  }
  if (state.screen !== 'display') return;

  if (inWindow) setClock(String(Math.max(1, Math.ceil(r.msToNextChange / 1000))), true, false);
  else setClock(formatCountdown(r.msToNextChange), false, false);

  const played = formatPlayed(elapsed);
  if (played !== state.elapsedText) {
    state.elapsedText = played;
    el.elapsed.textContent = played;
  }
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

function showSetup(prefilled) {
  state.screen = 'setup';
  state.prefilled = Boolean(prefilled);
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
    subMinutes: draft.subMinutes,
    names: draft.names
  });
}

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
  applyNameLength(setup);
  driftStep = 0;
  applyDrift();

  const r = rotation(setup, 0);
  el.setup.hidden = true;
  el.display.hidden = false;
  el.edit.hidden = false;
  el.body.classList.remove('call');
  paintRest(r);
  applyShrink();
  el.elapsed.textContent = '0:00';
  state.elapsedText = '';
  el.elapsed.hidden = true;
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
  setClock(String(left), true, true);
  if (left <= 5) tick880();
}

function abortKickOff() {
  if (state.screen !== 'countdown') return;
  state.screen = 'setup';
  state.pendingSetup = null;
  state.clockText = '';
  el.elapsed.hidden = false;
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
  el.elapsed.hidden = false;
  showDisplay();
  saveGame();

  whistle(700);
  el.body.style.setProperty('--ground-ms', '500ms');
  el.body.classList.add('call');
  window.setTimeout(() => {
    el.body.classList.remove('call');
    el.body.style.setProperty('--ground-ms', '200ms');
  }, 220);

  const r = rotation(setup, Math.max(0, elapsedMs()));
  window.setTimeout(() => announce(linesForKickOff(r)), 760);

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

  draft.gameType = gameTypeOf(pending ? pending.setup : epoch.setup);
  draft.subMinutes = Math.round((pending ? pending.setup : epoch.setup).subMinutes);
  draft.gameMinutes = Math.round((pending ? pending.setup : epoch.setup).gameMinutes);
  draft.mode = 'edit';
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
  const first = view(elapsedMs());
  el.chipCount.textContent = formatCountdown(first.r.msToNextChange);
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
      applyNameLength(setup);
      saveGame();
      saveSquad();
    }  }

  draft.mode = 'pre';
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
  applyShrink();
  setNotes();
  takeWakeLock();
}

function buildEditSetup(k) {
  const sizes = draft.names.map((names) => names.length);
  if (sizes.some((n) => n < 1)) return null;
  let setup = createSetup({
    gameType: draft.gameType,
    subMinutes: draft.subMinutes,
    gameMinutes: draft.gameMinutes,
    teams: [
      { name: TEAM_NAMES[0], players: draft.names[0] },
      { name: TEAM_NAMES[1], players: draft.names[1] }
    ]
  });
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

el.chip.addEventListener('click', commitEdit);

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

/* ========================================================= persistence */

function saveGame() {
  if (debug || !state.game) return;
  writeJSON(KEY_GAME, state.game);
}

function loadSquadIntoDraft(squad) {
  if (!squad || !Array.isArray(squad.names)) return false;
  const names = [0, 1].map((t) => (Array.isArray(squad.names[t]) ? squad.names[t].slice() : []));
  if (names[0].length === 0 && names[1].length === 0) return false;
  draft.names = names;
  if (Number.isFinite(squad.gameType)) draft.gameType = squad.gameType;
  if (Number.isFinite(squad.gameMinutes)) draft.gameMinutes = squad.gameMinutes;
  if (Number.isFinite(squad.subMinutes)) draft.subMinutes = squad.subMinutes;
  return true;
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
  applyNameLength(liveEpoch(now).setup);
  applyDrift();
  /* no dialog, and no voice for changes missed while the phone was dead */
  state.shownChange = k;
  state.pendingEdit = Boolean(pendingEpoch(now));
  showDisplay();
  paintRest(r);
  applyShrink();
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
    if (Number.isFinite(debug.subMinutes)) draft.subMinutes = debug.subMinutes;
    if (Number.isFinite(debug.gameMinutes)) draft.gameMinutes = debug.gameMinutes;
    for (let t = 0; t < 2; t += 1) {
      if (debug.squads[t]) draft.names[t] = debug.squads[t].slice(0, 24);
    }
  }
  const squad = debug ? null : readJSON(KEY_SQUAD);
  const prefilled = loadSquadIntoDraft(squad);
  if (!restoreGame()) showSetup(prefilled);
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
