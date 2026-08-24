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
  removed: [],
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
  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addName(t, input.value);
      input.value = '';
    }
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
  for (let t = 0; t < 2; t += 1) {
    const input = el.inputs[t];
    if (input.value.trim()) {
      addName(t, input.value);
      input.value = '';
    }
  }
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

/* replaced in step 3 by the full display */
function startDisplay() {
  state.screen = 'display';
  el.setup.hidden = true;
  el.display.hidden = false;
  el.body.classList.add('playing');
}

function kickOff() {
  saveSquad();
  state.base = lockClock(draftSetup());
  state.ops = [];
  state.setup = state.base;
  state.kickoff = nowMs();
  startDisplay();
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

function boot() {
  const squad = readJSON(KEY_SQUAD);
  const prefilled = loadSquadIntoDraft(squad);
  showSetup(prefilled);
  el.body.classList.remove('boot');
}

boot();
