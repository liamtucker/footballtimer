/*
 * app.js — the screens around rotation.js.
 *
 * rotation.js holds the whole rota. Nothing here recomputes any part of it.
 * This file owns: the setup screen, the display, the voice, the wake lock,
 * persistence, and the roster sheet.
 */

import {
  createSetup,
  lockClock,
  computeIntervalMs,
  rotation,
  addLateArrival,
  removePlayer,
  DEFAULT_DURATION_MIN,
  DEFAULT_SHIFTS_EACH,
  DEFAULT_TEAM_NAMES
} from './rotation.js';

const MS_PER_MINUTE = 60000;
const NAME_MAX = 12;
const DURATION_MIN = 30;
const DURATION_MAX = 150;
const DURATION_STEP = 5;
const SHIFTS_MIN = 1;
const SHIFTS_MAX = 4;

const COPY = {
  teamA: 'Bibs',
  teamB: 'No bibs',
  placeholderFirst: 'First to arrive',
  tagLast: 'In goal first',
  interval: 'Change every',
  start: 'Kick off',
  clear: 'Clear all',
  prefilled: 'Reorder for today. Delete anyone missing.',
  keeperLabel: 'In goal',
  subLabel: 'Sub',
  subsLabel: 'Subs',
  nextLabel: 'Next',
  lap: 'Round',
  errorTooSmall: 'Two names minimum.',
  warnDuplicate: 'Same name twice. Add an initial.',
  eventKickOff: 'Kick off',
  eventChange: 'Change'
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
 * Debug hook. Inert unless `?t=` is in the URL.
 *   ?t=0          start the game clock at 0 and expose window.rota
 *   ?t=330        start at 330 seconds elapsed
 *   ?t=5:30       the same, as m:ss
 *   &rate=60      run the clock 60x real time
 * With ?t= present nothing is written to localStorage.
 * window.rota.setElapsed(ms) / .getElapsed() / .rate(n) / .state
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
  return { offsetMs: seconds * 1000, rate, realOrigin: Date.now(), origin: Date.now() };
})();

function nowMs() {
  if (!debug) return Date.now();
  return debug.origin + (Date.now() - debug.realOrigin) * debug.rate;
}

function elapsedMs() {
  if (!state.kickoff) return 0;
  return Math.max(0, nowMs() - state.kickoff);
}

/* --------------------------------------------------------------- state */

const state = {
  screen: 'setup',
  draft: { durationMin: DEFAULT_DURATION_MIN, shiftsEach: DEFAULT_SHIFTS_EACH, arrivals: [[], []] },
  prefilled: false,
  base: null,
  ops: [],
  setup: null,
  kickoff: 0,
  lastChangeIndex: null,
  callUntil: 0,
  inCall: false,
  bigClock: false,
  clockText: '',
  holdClockUntil: 0,
  driftStep: 0,
  sheetOpen: false,
  sheetSwiped: false,
  degradedLock: false,
  degradedVoice: false,
  hintShown: false
};

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------- setup screen */

const el = {
  body: document.body,
  setup: $('setup'),
  display: $('display'),
  readout: $('readout'),
  steppers: $('steppers'),
  durationValue: $('duration-value'),
  shiftsValue: $('shifts-value'),
  heads: [$('head-0'), $('head-1')],
  pills: [$('pills-0'), $('pills-1')],
  inputs: [$('input-0'), $('input-1')],
  prefilledLine: $('prefilled'),
  clear: $('clear'),
  notice: $('notice'),
  start: $('start'),
  clock: $('clock'),
  lap: $('lap'),
  status: $('status'),
  scrim: $('scrim'),
  sheet: $('sheet'),
  sheetHeads: [$('sheet-head-0'), $('sheet-head-1')],
  sheetPills: [$('sheet-pills-0'), $('sheet-pills-1')],
  sheetInputs: [$('sheet-input-0'), $('sheet-input-1')]
};

function draftSetup() {
  return createSetup({
    durationMin: state.draft.durationMin,
    shiftsEach: state.draft.shiftsEach,
    teams: [
      { name: TEAM_NAMES[0], arrivals: state.draft.arrivals[0] },
      { name: TEAM_NAMES[1], arrivals: state.draft.arrivals[1] }
    ]
  });
}

function formatClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
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

function xIcon() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
}

function buildPill(name, isFirst) {
  const pill = document.createElement('span');
  pill.className = isFirst ? 'pill first' : 'pill';
  const label = document.createElement('span');
  label.className = 'pill-label';
  if (isFirst) {
    const tag = document.createElement('span');
    tag.className = 'pill-tag';
    tag.textContent = COPY.tagLast;
    label.appendChild(tag);
  }
  label.appendChild(document.createTextNode(name));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'pill-x';
  remove.innerHTML = xIcon();
  remove.setAttribute('aria-label', 'remove');
  pill.appendChild(label);
  pill.appendChild(remove);
  return pill;
}

function renderSetup() {
  for (let t = 0; t < 2; t += 1) {
    const names = state.draft.arrivals[t];
    el.heads[t].textContent = `${TEAM_NAMES[t]} · ${names.length}`;
    const host = el.pills[t];
    host.textContent = '';
    names.forEach((name, i) => {
      const pill = buildPill(name, i === names.length - 1);
      pill.dataset.team = String(t);
      pill.dataset.index = String(i);
      host.appendChild(pill);
    });
    el.inputs[t].placeholder = names.length === 0 ? COPY.placeholderFirst : '';
  }

  el.durationValue.textContent = String(state.draft.durationMin);
  el.shiftsValue.textContent = String(state.draft.shiftsEach);
  for (const button of el.steppers.querySelectorAll('.step')) {
    const which = button.dataset.step;
    const dir = Number(button.dataset.dir);
    const value = which === 'duration' ? state.draft.durationMin : state.draft.shiftsEach;
    const lo = which === 'duration' ? DURATION_MIN : SHIFTS_MIN;
    const hi = which === 'duration' ? DURATION_MAX : SHIFTS_MAX;
    button.disabled = dir < 0 ? value <= lo : value >= hi;
  }

  const sizes = state.draft.arrivals.map((names) => names.length);
  const valid = sizes.every((n) => n >= 2);

  el.readout.textContent = valid
    ? `${COPY.interval} ${formatClock(computeIntervalMs(draftSetup()))}`
    : '—';

  const anyTyped = sizes.some((n) => n > 0);
  const duplicate = state.draft.arrivals.some(duplicateIn);
  let notice = '';
  if (!valid && anyTyped) notice = COPY.errorTooSmall;
  else if (duplicate) notice = COPY.warnDuplicate;
  el.notice.textContent = notice;
  el.notice.hidden = notice === '';

  el.start.classList.toggle('hairline', !valid);
  el.prefilledLine.hidden = !state.prefilled;
}

function addName(teamIndex, raw) {
  const name = String(raw).trim().slice(0, NAME_MAX);
  if (!name) return;
  state.draft.arrivals[teamIndex].push(name);
  state.prefilled = false;
  renderSetup();
}

/* Tap a pill: it moves to the end of the list and becomes the first keeper. */
function movePillToEnd(teamIndex, index) {
  const names = state.draft.arrivals[teamIndex];
  if (index < 0 || index >= names.length) return;
  if (index === names.length - 1) return;

  const host = el.pills[teamIndex];
  const before = [...host.children].map((node) => node.getBoundingClientRect());

  const [name] = names.splice(index, 1);
  names.push(name);
  state.prefilled = false;
  renderSetup();

  if (prefersReducedMotion()) return;
  const after = [...host.children].map((node) => node.getBoundingClientRect());
  const order = names.map((_, i) => i);
  // map old position i -> new position
  const oldToNew = order.map((i) => (i < index ? i : i === index ? names.length - 1 : i - 1));
  [...host.children].forEach((node) => {
    node.classList.remove('moving');
  });
  before.forEach((rect, oldIndex) => {
    const newIndex = oldToNew[oldIndex];
    const node = host.children[newIndex];
    const to = after[newIndex];
    if (!node || !to) return;
    const dx = rect.left - to.left;
    const dy = rect.top - to.top;
    if (dx === 0 && dy === 0) return;
    node.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  requestAnimationFrame(() => {
    [...host.children].forEach((node) => {
      node.classList.add('moving');
      node.style.transform = '';
    });
  });
}

function removeName(teamIndex, index) {
  state.draft.arrivals[teamIndex].splice(index, 1);
  state.prefilled = false;
  renderSetup();
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------- setup wiring */

const pendingNames = ['', ''];

function flushPendingNames() {
  let changed = false;
  for (let t = 0; t < 2; t += 1) {
    const parked = pendingNames[t];
    pendingNames[t] = '';
    const typed = el.inputs[t].value.trim();
    el.inputs[t].value = '';
    for (const raw of [parked, typed]) {
      const name = String(raw || '').trim().slice(0, NAME_MAX);
      if (!name) continue;
      state.draft.arrivals[t].push(name);
      state.prefilled = false;
      changed = true;
    }
  }
  if (changed) renderSetup();
  return changed;
}

for (let t = 0; t < 2; t += 1) {
  const input = el.inputs[t];
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addName(t, input.value);
      input.value = '';
      input.focus();
    }
  });
  input.addEventListener('input', () => {
    if (input.value.includes(',')) {
      const parts = input.value.split(',');
      const tail = parts.pop();
      for (const part of parts) addName(t, part);
      input.value = tail;
    }
  });
  /* A half-typed name must survive the blur that a tap on a pill or on Kick
     off causes. Park it and flush it after the click has been dispatched,
     or the re-render swallows the tap and the name never lands. */
  input.addEventListener('blur', () => {
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    pendingNames[t] = value;
    window.setTimeout(flushPendingNames, 0);
  });
  el.pills[t].addEventListener('click', (event) => {
    const pill = event.target.closest('.pill');
    if (!pill) return;
    const index = Number(pill.dataset.index);
    if (event.target.closest('.pill-x')) removeName(t, index);
    else movePillToEnd(t, index);
  });
}

el.readout.addEventListener('click', () => {
  const open = el.steppers.hidden;
  if (open) expandSteppers();
  else collapseSteppers();
});

function expandSteppers() {
  el.steppers.hidden = false;
  el.readout.setAttribute('aria-expanded', 'true');
  if (prefersReducedMotion()) return;
  const height = el.steppers.scrollHeight;
  el.steppers.style.height = '0px';
  el.steppers.style.opacity = '0';
  el.steppers.classList.add('expanding');
  requestAnimationFrame(() => {
    el.steppers.style.height = `${height}px`;
    el.steppers.style.opacity = '1';
  });
  window.setTimeout(() => {
    el.steppers.classList.remove('expanding');
    el.steppers.style.height = '';
    el.steppers.style.opacity = '';
  }, 250);
}

function collapseSteppers() {
  el.readout.setAttribute('aria-expanded', 'false');
  if (prefersReducedMotion()) {
    el.steppers.hidden = true;
    return;
  }
  const height = el.steppers.scrollHeight;
  el.steppers.style.height = `${height}px`;
  el.steppers.classList.add('collapsing');
  requestAnimationFrame(() => {
    el.steppers.style.height = '0px';
    el.steppers.style.opacity = '0';
  });
  window.setTimeout(() => {
    el.steppers.classList.remove('collapsing');
    el.steppers.style.height = '';
    el.steppers.style.opacity = '';
    el.steppers.hidden = true;
  }, 250);
}

el.steppers.addEventListener('click', (event) => {
  const button = event.target.closest('.step');
  if (!button) return;
  const dir = Number(button.dataset.dir);
  if (button.dataset.step === 'duration') {
    const next = state.draft.durationMin + dir * DURATION_STEP;
    state.draft.durationMin = Math.min(DURATION_MAX, Math.max(DURATION_MIN, next));
  } else {
    const next = state.draft.shiftsEach + dir;
    state.draft.shiftsEach = Math.min(SHIFTS_MAX, Math.max(SHIFTS_MIN, next));
  }
  renderSetup();
});

document.addEventListener('click', (event) => {
  if (el.steppers.hidden) return;
  if (event.target.closest('#steppers') || event.target.closest('#readout')) return;
  collapseSteppers();
});

el.clear.addEventListener('click', () => {
  state.draft.arrivals = [[], []];
  state.prefilled = false;
  dropKey(KEY_SQUAD);
  renderSetup();
});

el.start.addEventListener('click', () => {
  flushPendingNames();
  const sizes = state.draft.arrivals.map((names) => names.length);
  const shortest = sizes[0] <= sizes[1] ? 0 : 1;
  if (sizes.some((n) => n < 2)) {
    el.inputs[shortest].focus();
    renderSetup();
    return;
  }
  kickOff();
});

function saveSquad() {
  writeJSON(KEY_SQUAD, {
    durationMin: state.draft.durationMin,
    shiftsEach: state.draft.shiftsEach,
    arrivals: state.draft.arrivals
  });
}

function showSetup(prefilled) {
  state.screen = 'setup';
  state.prefilled = Boolean(prefilled);
  el.setup.hidden = false;
  el.display.hidden = true;
  el.body.classList.remove('call', 'playing');
  renderSetup();
}


/* -------------------------------------------------------------- display */

const DRIFT = [[0, 0], [2, 1], [0, 2], [-2, 1]];

const teamEls = [0, 1].map((t) => {
  const root = el.display.querySelector(`.team[data-team="${t}"]`);
  return {
    root,
    header: root.querySelector('.team-header'),
    name: root.querySelector('.team-name'),
    subs: root.querySelector('.subs'),
    strip: root.querySelector('.strip'),
    track: root.querySelector('.strip-track'),
    hint: root.querySelector('.kickoff-hint')
  };
});

function layerPair(host) {
  const nodes = host.querySelectorAll(':scope > .layer');
  const active = host.dataset.active === '1' ? 1 : 0;
  host.dataset.active = String(1 - active);
  return { out: nodes[active], in: nodes[1 - active] };
}

function fillHeader(node, teamName, moment) {
  node.textContent = `${teamName} — ${moment}`;
}

function fillName(node, text, scale) {
  node.textContent = '';
  const glyph = document.createElement('span');
  glyph.className = 'glyph';
  glyph.style.setProperty('--sc', String(scale));
  glyph.textContent = text || '';
  node.appendChild(glyph);
}

function fillSubs(node, names) {
  node.textContent = '';
  if (!names || names.length === 0) return;
  const prefix = document.createElement('span');
  prefix.className = 'prefix';
  prefix.textContent = names.length > 1 ? COPY.subsLabel : COPY.subLabel;
  node.appendChild(prefix);
  names.forEach((player, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 's-sep';
      sep.textContent = '·';
      node.appendChild(sep);
    }
    node.appendChild(document.createTextNode(player.name));
  });
}

function buildStrip(track, teamState) {
  track.textContent = '';
  const n = teamState.order.length;
  if (n === 0) return;
  const bench = new Set(teamState.subIndexes);
  for (let i = 0; i < n; i += 1) {
    const index = (teamState.keeperIndex + i) % n;
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 's-sep';
      sep.textContent = '·';
      track.appendChild(sep);
    }
    const item = document.createElement('span');
    item.className = bench.has(index) ? 's-item bench' : 's-item';
    item.textContent = teamState.order[index].name;
    track.appendChild(item);
  }
}

function measureFirstWidth(track) {
  const items = track.querySelectorAll('.s-item');
  if (items.length < 2) return 0;
  return items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().left;
}

function writeFirstWidth(track) {
  track.style.setProperty('--first-w', `${measureFirstWidth(track)}px`);
}

function applyNameLength() {
  let longest = 5;
  for (const team of state.setup.teams) {
    for (const player of team.players) longest = Math.max(longest, player.name.length);
  }
  document.documentElement.style.setProperty('--len', String(longest));
}

function advanceDrift() {
  state.driftStep = (state.driftStep + 1) % DRIFT.length;
  const [x, y] = DRIFT[state.driftStep];
  document.documentElement.style.setProperty('--drift-x', `${x}px`);
  document.documentElement.style.setProperty('--drift-y', `${y}px`);
}

/* Put a host into a new content state. `how` is 'change', 'fade' or 'now'. */
function swap(host, fill, how, options = {}) {
  const pair = layerPair(host);
  fill(pair.in);
  pair.out.className = 'layer';
  pair.in.className = 'layer';
  if (how === 'now') {
    pair.in.classList.add('on');
    return;
  }
  if (how === 'change') {
    pair.out.classList.add('anim-out');
    pair.in.classList.add('anim-in');
    window.setTimeout(() => {
      if (pair.in.classList.contains('anim-in')) {
        pair.in.className = 'layer on';
        pair.out.className = 'layer';
      }
    }, 780);
    return;
  }
  // fade
  const ms = options.ms ?? 400;
  const delay = options.delay ?? 0;
  pair.out.style.setProperty('--fade-ms', `${ms}ms`);
  pair.out.style.setProperty('--fade-delay', `${delay}ms`);
  pair.in.style.setProperty('--fade-ms', `${ms}ms`);
  pair.in.style.setProperty('--fade-delay', `${delay}ms`);
  pair.out.classList.add('on', 'fading');
  pair.in.classList.add('fading');
  void pair.in.offsetWidth;
  pair.out.classList.remove('on');
  pair.in.classList.add('on');
}

/* The shift the screen is showing: 'now' during the call, 'next' while waiting. */
function paint(r, moment, how, options) {
  r.teams.forEach((team, t) => {
    const parts = teamEls[t];
    const isNow = moment === 'now';
    const keeper = isNow ? team.keeper : team.nextKeeper;
    const subs = isNow ? team.subs : team.nextSubs;
    const label = isNow ? COPY.keeperLabel : COPY.nextLabel;
    const scale = isNow ? 1 : 0.8;

    swap(parts.header, (node) => fillHeader(node, team.name, label), how === 'change' ? 'fade' : how,
      how === 'change' ? { ms: 150, delay: 120 } : options);
    swap(parts.name, (node) => fillName(node, keeper ? keeper.name : '', scale), how, options);

    parts.subs.hidden = subs.length === 0;
    if (subs.length > 0) swap(parts.subs, (node) => fillSubs(node, subs), how, options);
    else swap(parts.subs, (node) => fillSubs(node, []), 'now');
  });
}

function rebuildStrips(r) {
  r.teams.forEach((team, t) => {
    const parts = teamEls[t];
    parts.track.classList.remove('sliding');
    parts.track.style.transform = '';
    buildStrip(parts.track, team);
    writeFirstWidth(parts.track);
  });
}

function slideStrips() {
  teamEls.forEach((parts) => {
    writeFirstWidth(parts.track);
    void parts.track.offsetWidth;
    parts.track.classList.add('sliding');
  });
}

/* ------------------------------------------------------------ the change */

function runChange(r, mode) {
  /* motion runs on real time; only the rota runs on the game clock */
  const now = Date.now();
  const animate = mode === 'kickoff' || mode === 'step';

  if (mode === 'restore') {
    state.inCall = false;
    el.body.classList.remove('call');
    paint(r, 'next', 'now');
    rebuildStrips(r);
    for (const parts of teamEls) if (parts.hint) parts.hint.hidden = true;
    return;
  }

  if (state.sheetOpen) closeSheet();
  advanceDrift();
  if (mode !== 'kickoff') state.holdClockUntil = now + 120;
  state.inCall = true;
  state.callStart = now;
  state.callUntil = now + 6000;
  el.body.classList.add('call');

  if (animate && prefersReducedMotion()) {
    /* the conveyor becomes a crossfade in place and the strip rebuilds at once */
    paint(r, 'now', 'change');
    rebuildStrips(r);
  } else if (animate) {
    slideStrips();
    paint(r, 'now', 'change');
    window.setTimeout(() => {
      if (state.screen !== 'display') return;
      rebuildStrips(rotation(state.setup, elapsedMs()));
    }, 720);
  } else {
    paint(r, 'now', 'now');
    rebuildStrips(r);
  }

  if (mode === 'kickoff' && !state.hintShown && teamEls[0].hint) {
    state.hintShown = true;
    teamEls[0].hint.hidden = false;
    teamEls[0].strip.hidden = true;
  }

  announce(r, mode === 'kickoff' ? COPY.eventKickOff : COPY.eventChange);
}

function endCall() {
  state.inCall = false;
  el.body.classList.remove('call');
  for (const parts of teamEls) {
    if (parts.hint) parts.hint.hidden = true;
    parts.strip.hidden = false;
  }

  const r = rotation(state.setup, elapsedMs());
  paint(r, 'next', 'fade', { ms: 400, delay: 0 });
  rebuildStrips(r);
}

/* ------------------------------------------------------------- the clock */

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function applyClock(text, big) {
  el.clock.textContent = text;
  el.clock.classList.toggle('big', big);
  state.clockText = text;
}

function startClockSwap(text) {
  if (prefersReducedMotion()) {
    applyClock(text, true);
    return;
  }
  state.clockSwapping = true;
  el.clock.classList.add('swapping', 'swap-hidden');
  window.setTimeout(() => {
    applyClock(text, true);
    el.clock.classList.remove('swapping', 'swap-hidden');
    el.clock.classList.add('swap-enter');
    void el.clock.offsetWidth;
    el.clock.classList.add('swapping');
    el.clock.classList.remove('swap-enter');
    window.setTimeout(() => {
      el.clock.classList.remove('swapping');
      state.clockSwapping = false;
    }, 160);
  }, 150);
}

function updateClock(r) {
  /* the change holds the clock on zero, then swaps instantly. never a digit
     animation at a change: the swap belongs to T-9s and nowhere else. */
  if (Date.now() < state.holdClockUntil) {
    if (state.clockText !== '0' || !state.bigClock) {
      state.clockSwapping = false;
      state.bigClock = true;
      el.clock.classList.remove('swapping', 'swap-hidden', 'swap-enter');
      applyClock('0', true);
    }
    return;
  }

  let text;
  let big;
  if (r.msToNextChange <= 9000) {
    text = String(Math.max(0, Math.ceil(r.msToNextChange / 1000)));
    big = true;
  } else {
    text = formatCountdown(r.msToNextChange);
    big = false;
  }

  if (state.clockSwapping) return;

  if (big !== state.bigClock) {
    state.bigClock = big;
    if (big) startClockSwap(text);
    else applyClock(text, false);
    return;
  }
  if (text !== state.clockText) applyClock(text, big);
}

function updateMarks(r) {
  const lapNumber = r.totalChanges > 0 ? Math.floor(r.changeIndex / r.totalChanges) + 1 : 1;
  const showLap = lapNumber >= 2;
  el.lap.hidden = !showLap;
  if (showLap) el.lap.textContent = `${COPY.lap} ${lapNumber}`;
  el.status.hidden = !(state.degradedLock || state.degradedVoice);
}

/* --------------------------------------------------------------- the loop */

let rafId = 0;
let intervalId = 0;

function tick() {
  if (state.screen !== 'display' || !state.setup) return;
  const now = nowMs();
  const elapsed = Math.max(0, now - state.kickoff);
  const r = rotation(state.setup, elapsed);

  if (r.changeIndex !== state.lastChangeIndex) {
    const previous = state.lastChangeIndex;
    state.lastChangeIndex = r.changeIndex;
    let mode;
    if (state.pendingRestore) mode = 'restore';
    else if (previous === null) mode = 'kickoff';
    else if (r.changeIndex - previous === 1) mode = 'step';
    else mode = 'jump';
    state.pendingRestore = false;
    runChange(r, mode);
  }

  updateClock(r);
  updateMarks(r);
  if (state.inCall && Date.now() >= state.callUntil) endCall();
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
  tick();
  takeWakeLock();
});

/* ------------------------------------------------------------ the voice */

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
    utterance.rate = 1;
    let started = false;
    utterance.onstart = () => { started = true; voiceReady = true; state.degradedVoice = false; };
    utterance.onerror = () => { state.degradedVoice = true; };
    speechSynthesis.speak(utterance);
    state.degradedVoice = false;
    /* the test is not the call, it is what comes back from it */
    window.setTimeout(() => {
      if (started || voiceReady) return;
      if (!speechSynthesis.speaking && !speechSynthesis.pending) state.degradedVoice = true;
    }, 1500);
  } catch (error) {
    state.degradedVoice = true;
  }
}

function extendCall(untilMs) {
  const cap = (state.callStart || 0) + 12000;
  state.callUntil = Math.min(cap, Math.max(state.callUntil, untilMs));
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    state.degradedVoice = true;
    return;
  }
  try {
    /* iOS drops the queue when the page is backgrounded and leaves the engine
       stuck. cancel() before every speak() is the only reliable reset. */
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
    let started = false;
    utterance.onstart = () => {
      started = true;
      voiceReady = true;
      state.degradedVoice = false;
    };
      utterance.onend = () => extendCall(Date.now() + 2000);
    utterance.onerror = () => { state.degradedVoice = true; };
    speechSynthesis.speak(utterance);
    window.setTimeout(() => {
      if (!started && !speechSynthesis.speaking && !speechSynthesis.pending) state.degradedVoice = true;
    }, 1500);
  } catch (error) {
    state.degradedVoice = true;
  }
}

/* ------------------------------------------------------------ announce */

function joinNames(players) {
  const names = players.map((p) => p.name);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function announcementFor(r, event) {
  const parts = [`${event}.`];
  for (const team of r.teams) {
    if (!team.keeper) continue;
    parts.push(`${team.name}.`);
    parts.push(`${team.keeper.name} in goal.`);
    if (team.subs.length > 0) parts.push(`${joinNames(team.subs)} off.`);
  }
  return parts.join(' ');
}

function announce(r, event) {
  speak(announcementFor(r, event));
}

/* --------------------------------------------------------------- start */

function startDisplay(options = {}) {
  state.screen = 'display';
  state.pendingRestore = Boolean(options.restored);
  state.lastChangeIndex = null;
  state.inCall = false;
  state.bigClock = false;
  state.clockText = '';
  state.holdClockUntil = 0;
  el.setup.hidden = true;
  el.display.hidden = false;
  el.body.classList.remove('call');
  applyNameLength();
  const [x, y] = DRIFT[state.driftStep];
  document.documentElement.style.setProperty('--drift-x', `${x}px`);
  document.documentElement.style.setProperty('--drift-y', `${y}px`);
  takeWakeLock();
  startLoop();
  tick();
}

function kickOff() {
  saveSquad();
  unlockVoice();
  state.base = lockClock(draftSetup());
  state.ops = [];
  state.setup = state.base;
  state.kickoff = nowMs() - (debug ? debug.offsetMs : 0);
  saveGame();
  startDisplay({ restored: false });
}

/* ---------------------------------------------------------------- boot */

function loadSquadIntoDraft(squad) {
  if (!squad || !Array.isArray(squad.arrivals)) return false;
  const arrivals = [0, 1].map((t) => (Array.isArray(squad.arrivals[t]) ? squad.arrivals[t].slice() : []));
  if (arrivals[0].length === 0 && arrivals[1].length === 0) return false;
  state.draft.arrivals = arrivals;
  if (Number.isFinite(squad.durationMin)) state.draft.durationMin = squad.durationMin;
  if (Number.isFinite(squad.shiftsEach)) state.draft.shiftsEach = squad.shiftsEach;
  return true;
}

function saveGame() {
  if (debug) return;
  writeJSON(KEY_GAME, { base: state.base, ops: state.ops, kickoff: state.kickoff });
}

function restoreGame() {
  const game = readJSON(KEY_GAME);
  if (!game || !game.base || !Number.isFinite(game.kickoff)) return false;
  const setup = replay(game.base, Array.isArray(game.ops) ? game.ops : []);
  const elapsed = Date.now() - game.kickoff;
  const limit = (Number(setup.durationMin) || DEFAULT_DURATION_MIN) * MS_PER_MINUTE + 60 * MS_PER_MINUTE;
  if (elapsed < 0 || elapsed > limit) {
    dropKey(KEY_GAME);
    return false;
  }
  state.base = game.base;
  state.ops = Array.isArray(game.ops) ? game.ops : [];
  state.setup = setup;
  state.kickoff = game.kickoff;
  if (debug) state.kickoff = nowMs() - debug.offsetMs;
  startDisplay({ restored: true });
  return true;
}

/* --------------------------------------------------------- staying alive */

let wakeLock = null;

function takeWakeLock() {
  if (state.screen !== 'display') return;
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
      if (state.screen === 'display') state.degradedLock = true;
    });
  }).catch(() => {
    state.degradedLock = true;
  });
}

/* A single tap on the display re-takes the lock and re-tests the voice. */
function clearDegraded() {
  takeWakeLock();
  unlockVoice();
}

/* -------------------------------------------------------- roster sheet */

/*
 * The two mid-game actions. Both are facts, not decisions.
 * Every change is an engine rewrite: the app keeps the kick-off setup and an
 * ordered log of operations, and the live setup is the replay of that log.
 * Undo is dropping one entry and replaying, which is why a gone name can be
 * tapped back without a confirmation dialogue.
 */

const SHEET_IDLE_MS = 10000;
let sheetIdleTimer = 0;

function replay(base, ops) {
  let setup = base;
  for (const op of ops) {
    if (op.type === 'add') setup = addLateArrival(setup, op.team, op.name, op.elapsed);
    else if (op.type === 'remove') setup = removePlayer(setup, op.team, op.playerId, op.elapsed);
  }
  return setup;
}

function afterRosterChange() {
  applyNameLength();
  const r = rotation(state.setup, elapsedMs());
  paint(r, state.inCall ? 'now' : 'next', 'now');
  rebuildStrips(r);
  renderSheet();
}

function commitOps(ops) {
  state.ops = ops;
  state.setup = replay(state.base, state.ops);
  saveGame();
  afterRosterChange();
}

function sheetPill(name, gone) {
  const pill = document.createElement('span');
  pill.className = gone ? 'pill gone' : 'pill';
  const label = document.createElement('span');
  label.className = 'pill-label';
  label.textContent = name;
  pill.appendChild(label);
  return pill;
}

function renderSheet() {
  if (!state.setup) return;
  for (let t = 0; t < 2; t += 1) {
    const team = state.setup.teams[t];
    const players = team ? team.players : [];
    el.sheetHeads[t].textContent = `${TEAM_NAMES[t]} · ${players.length}`;
    const host = el.sheetPills[t];
    host.textContent = '';
    for (const player of players) {
      const pill = sheetPill(player.name, false);
      pill.dataset.playerId = player.id;
      host.appendChild(pill);
    }
    state.ops.forEach((op, index) => {
      if (op.type !== 'remove' || op.team !== t) return;
      const pill = sheetPill(op.name, true);
      pill.dataset.opIndex = String(index);
      host.appendChild(pill);
    });
  }
}

function touchSheetIdle() {
  window.clearTimeout(sheetIdleTimer);
  sheetIdleTimer = window.setTimeout(closeSheet, SHEET_IDLE_MS);
}

function openSheet() {
  if (state.screen !== 'display' || state.sheetOpen) return;
  state.sheetOpen = true;
  renderSheet();
  el.scrim.hidden = false;
  el.sheet.hidden = false;
  void el.sheet.offsetWidth;
  el.scrim.classList.add('up');
  el.sheet.classList.add('up');
  touchSheetIdle();
}

function closeSheet() {
  if (!state.sheetOpen) return;
  state.sheetOpen = false;
  window.clearTimeout(sheetIdleTimer);
  for (const input of el.sheetInputs) input.value = '';
  el.scrim.classList.remove('up');
  el.sheet.classList.remove('up');
  window.setTimeout(() => {
    if (state.sheetOpen) return;
    el.scrim.hidden = true;
    el.sheet.hidden = true;
  }, 300);
}

el.scrim.addEventListener('click', closeSheet);

for (let t = 0; t < 2; t += 1) {
  el.sheetPills[t].addEventListener('click', (event) => {
    const pill = event.target.closest('.pill');
    if (!pill || state.sheetSwiped) return;
    touchSheetIdle();
    if (pill.dataset.opIndex !== undefined) {
      const index = Number(pill.dataset.opIndex);
      commitOps(state.ops.filter((_, i) => i !== index));
      return;
    }
    const playerId = pill.dataset.playerId;
    const player = state.setup.teams[t].players.find((p) => p.id === playerId);
    if (!player) return;
    commitOps([...state.ops, {
      type: 'remove', team: t, playerId, name: player.name, elapsed: elapsedMs()
    }]);
  });

  const input = el.sheetInputs[t];
  input.addEventListener('keydown', (event) => {
    touchSheetIdle();
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    const name = input.value.trim().slice(0, NAME_MAX);
    input.value = '';
    if (!name) return;
    commitOps([...state.ops, { type: 'add', team: t, name, elapsed: elapsedMs() }]);
  });
  input.addEventListener('focus', touchSheetIdle);
}

/* swipe down to dismiss, and never let a swipe read as a pill tap */
let sheetDrag = null;
el.sheet.addEventListener('pointerdown', (event) => {
  sheetDrag = { y: event.clientY };
  state.sheetSwiped = false;
  touchSheetIdle();
});
el.sheet.addEventListener('pointermove', (event) => {
  if (!sheetDrag) return;
  if (event.clientY - sheetDrag.y > 60) {
    state.sheetSwiped = true;
    sheetDrag = null;
    closeSheet();
  } else if (Math.abs(event.clientY - sheetDrag.y) > 12) {
    state.sheetSwiped = true;
  }
});
el.sheet.addEventListener('pointerup', () => { sheetDrag = null; });
el.sheet.addEventListener('pointercancel', () => { sheetDrag = null; state.sheetSwiped = false; });

/* press and hold anywhere on the display opens it. a single tap clears the
   degraded marker by re-taking the lock and re-testing the voice. */
let displayPress = null;

el.display.addEventListener('pointerdown', (event) => {
  if (state.sheetOpen) return;
  displayPress = { x: event.clientX, y: event.clientY, moved: false, fired: false };
  displayPress.timer = window.setTimeout(() => {
    if (!displayPress || displayPress.moved) return;
    displayPress.fired = true;
    openSheet();
  }, 700);
});

el.display.addEventListener('pointermove', (event) => {
  if (!displayPress) return;
  const dx = event.clientX - displayPress.x;
  const dy = event.clientY - displayPress.y;
  if (Math.sqrt(dx * dx + dy * dy) > 12) {
    displayPress.moved = true;
    window.clearTimeout(displayPress.timer);
  }
});

function endDisplayPress(tapped) {
  if (!displayPress) return;
  window.clearTimeout(displayPress.timer);
  if (tapped && !displayPress.fired && !displayPress.moved) clearDegraded();
  displayPress = null;
}

el.display.addEventListener('pointerup', () => endDisplayPress(true));
el.display.addEventListener('pointercancel', () => endDisplayPress(false));
el.display.addEventListener('contextmenu', (event) => event.preventDefault());

/* ---------------------------------------------------------- debug hook */

if (debug) {
  window.rota = {
    state,
    rotation,
    getElapsed: () => elapsedMs(),
    setElapsed(ms) {
      state.kickoff = nowMs() - Math.max(0, Number(ms) || 0);
      tick();
      return elapsedMs();
    },
    rate(n) {
      debug.origin = nowMs();
      debug.realOrigin = Date.now();
      debug.rate = Math.max(0, Number(n) || 0);
      return debug.rate;
    },
    tick
  };
}

function boot() {
  const squad = readJSON(KEY_SQUAD);
  const prefilled = loadSquadIntoDraft(squad);
  if (!restoreGame()) showSetup(prefilled);
  el.body.classList.remove('boot');
}

boot();

/* ------------------------------------------------------------- offline */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* no service worker is still a working page, just not an offline one */
    });
  });
}
