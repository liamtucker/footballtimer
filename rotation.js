/*
 * rotation.js — the goalkeeper rota engine.
 *
 * One pure function. No clock, no stored state, no mutation of its arguments.
 * `rotation(setup, elapsedMs)` always returns the same answer for the same two
 * inputs, so a phone that dies mid-game restores the setup and the kick-off
 * timestamp from localStorage and carries on at the right shift.
 *
 * WHY THE SETUP HOLDS A RESOLVED ORDER
 *
 * Names are typed in arrival order. The rota runs alphabetically, and the first
 * keeper is the last person to arrive. `createSetup()` does that translation
 * once, at setup time, and stores the result: `team.players` IS the goal order.
 * The engine never sorts. Two reasons. A sort at read time is locale dependent,
 * and the order must be identical on every device and after every restore. And
 * a late arrival lands in a position that is not their alphabetical one, so the
 * order stops being derivable from the names the moment the roster changes. An
 * explicit list is the only honest description of the live order.
 *
 * WHY THE START POINT IS AN ANCHOR AND NOT AN INDEX
 *
 * `team.anchor = { changeIndex, playerId }` reads "at this change, this player
 * is in goal". Everything else counts forward from it:
 *
 *     keeper(k) = order[(indexOf(anchor.playerId) + k - anchor.changeIndex) mod n]
 *
 * At kick-off the anchor is `{ changeIndex: 0, playerId: <last to arrive> }`,
 * which is the spec rule written down directly. An index would move under a
 * roster change; a player id plus the change it applies to does not. A roster
 * change re-anchors on the player who is in goal at that moment, which is what
 * keeps the current keeper fixed mid-shift.
 *
 * THE TWO ROSTER CHANGES ARE SETUP REWRITES, NOT HISTORY
 *
 * `addLateArrival()` and `removePlayer()` each return a NEW setup. There is no
 * event log to replay. The app writes the returned setup to localStorage and
 * everything stays a pure function of (setup, elapsedMs). `Undo` is free: keep
 * the previous setup object and put it back.
 *
 * Late arrival. The new player is spliced in immediately behind the pointer —
 * the slot straight after the player who is in goal now — and the team is
 * re-anchored on that same current keeper. Consequences, all of them wanted:
 * the current shift does not change, the late arrival is in goal at the very
 * next change, the clock does not move, and their next turn is a full lap of
 * the new list away. The player who was due next is pushed one change back, not
 * skipped for good; every player still serves once per lap, which is the thing
 * the on-screen order has to be able to justify to a sceptic on the pitch.
 *
 * Gone home. The player is filtered out of `team.players`, so their name can
 * never come up again as keeper or as sub. The team is re-anchored on the
 * player who is in goal at that moment, so a removal never changes the current
 * keeper. If the person who leaves IS the keeper, the shift they abandoned goes
 * to the player who was next, and the rota carries on from there — the clock
 * does not move for them either.
 *
 * THE INTERVAL IS FROZEN AT KICK-OFF
 *
 * `setup.clockN` holds the squad size the interval is computed from. `null`
 * means "work it out from the current squads", which is what the setup screen
 * wants while names are still being typed. `lockClock()` writes the value in,
 * and both roster helpers call it first, so the interval is frozen no later
 * than the first mid-game change. A recomputed interval would move every future
 * change time the instant a player arrives or leaves — the countdown on the
 * screen would jump, and a rota that jumps is a rota people argue with. Frozen
 * costs only this: after a change the larger squad no longer gets exactly S
 * shifts. That is arithmetic nobody watches. A clock that jumps is.
 *
 * SUB SLOTS
 *
 * Spec: `subs = (keeper + floor(n / 2) + j) mod n`. The offset is clamped to
 * `n - subCount` so a sub slot can never land on the keeper. The clamp is
 * inert at every realistic squad size (it first bites at 14 in one team) and
 * `n - subCount` is always 6, so above 12 the subs are simply everyone who is
 * not one of the six on the pitch.
 *
 * A NOTE ON ASKING ABOUT THE PAST
 *
 * A setup describes the roster as it is now. After a roster change, a query for
 * an earlier `elapsedMs` returns what that change WOULD have been under the
 * present roster, not what the screen said at the time. The engine keeps no
 * history, by design. Only the current change and the next one are ever shown.
 */

export const MS_PER_MINUTE = 60000;
export const QUANTUM_MS = 15000; // the interval floors to whole 15 seconds
export const PLAYERS_ON_PITCH = 6;
export const DEFAULT_DURATION_MIN = 90;
export const DEFAULT_SHIFTS_EACH = 2;
export const DEFAULT_TEAM_NAMES = ['Bibs', 'No bibs'];

/* ---------------------------------------------------------------- helpers */

function mod(a, b) {
  return ((a % b) + b) % b;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function copyPlayer(player) {
  return { id: player.id, name: player.name };
}

function subCountFor(squadSize) {
  return Math.max(0, squadSize - PLAYERS_ON_PITCH);
}

/* ------------------------------------------------------------------ setup */

/**
 * Build a setup from names in arrival order.
 *
 * createSetup({
 *   durationMin: 90,
 *   shiftsEach: 2,
 *   teams: [{ name: 'Bibs', arrivals: ['Zoe', 'Alex', 'Sam'] }, { ... }]
 * })
 *
 * Call it again on every keystroke while the setup screen is open. The ids are
 * derived from the arrival position, so the result is stable and pure.
 */
export function createSetup(input = {}) {
  const durationMin = Math.max(1, num(input.durationMin, DEFAULT_DURATION_MIN));
  const shiftsEach = Math.max(1, Math.floor(num(input.shiftsEach, DEFAULT_SHIFTS_EACH)));
  const teamsIn = Array.isArray(input.teams) ? input.teams : [];

  const teams = teamsIn.map((team, teamIndex) => {
    const arrivals = (Array.isArray(team.arrivals) ? team.arrivals : [])
      .map((name) => String(name).trim())
      .filter((name) => name.length > 0);

    const records = arrivals.map((name, arrivalIndex) => ({
      id: `t${teamIndex}p${arrivalIndex}`,
      name,
      arrivalIndex
    }));

    const players = records
      .slice()
      .sort(byFirstName)
      .map(copyPlayer);

    const last = records[records.length - 1];

    return {
      name: String(team.name ?? DEFAULT_TEAM_NAMES[teamIndex] ?? `Team ${teamIndex + 1}`),
      players,
      anchor: last ? { changeIndex: 0, playerId: last.id } : null
    };
  });

  return { durationMin, shiftsEach, clockN: null, teams };
}

function byFirstName(a, b) {
  const compared = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  if (compared !== 0) return compared;
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return a.arrivalIndex - b.arrivalIndex;
}

/** The squad size the interval comes from. The larger of the two, until locked. */
export function clockSquadSize(setup) {
  const locked = num(setup.clockN, 0);
  if (locked > 0) return Math.floor(locked);
  const sizes = (setup.teams ?? []).map((team) => (team.players ?? []).length);
  return Math.max(1, ...sizes);
}

/** Freeze the interval. Idempotent. Both roster helpers call it first. */
export function lockClock(setup) {
  if (num(setup.clockN, 0) > 0) return setup;
  return { ...setup, clockN: clockSquadSize(setup) };
}

/** interval = duration / (N * S), floored to whole 15 seconds. */
export function computeIntervalMs(setup) {
  const shiftsEach = Math.max(1, Math.floor(num(setup.shiftsEach, DEFAULT_SHIFTS_EACH)));
  const durationMs = Math.max(0, num(setup.durationMin, DEFAULT_DURATION_MIN)) * MS_PER_MINUTE;
  const changes = clockSquadSize(setup) * shiftsEach;
  const raw = durationMs / changes;
  return Math.max(QUANTUM_MS, Math.floor(raw / QUANTUM_MS) * QUANTUM_MS);
}

/** Changes in one planned rotation. After this many, the larger squad has had S each. */
export function totalChangesIn(setup) {
  const shiftsEach = Math.max(1, Math.floor(num(setup.shiftsEach, DEFAULT_SHIFTS_EACH)));
  return clockSquadSize(setup) * shiftsEach;
}

/** Which change the game is on. Counts past the duration and never stops. */
export function changeIndexAt(setup, elapsedMs) {
  const elapsed = Math.max(0, num(elapsedMs, 0));
  return Math.floor(elapsed / computeIntervalMs(setup));
}

/* ----------------------------------------------------------------- engine */

function slotsAt(team, changeIndex) {
  const order = (team.players ?? []).map(copyPlayer);
  const n = order.length;
  if (n === 0) return { order, n, keeperIndex: -1, subIndexes: [] };

  const anchor = team.anchor ?? null;
  const anchorAt = num(anchor && anchor.changeIndex, 0);
  let anchorIndex = order.findIndex((player) => player.id === (anchor && anchor.playerId));
  if (anchorIndex < 0) anchorIndex = 0;

  const keeperIndex = mod(anchorIndex + (changeIndex - anchorAt), n);

  const subCount = subCountFor(n);
  const subIndexes = [];
  if (subCount > 0) {
    const offset = Math.min(Math.floor(n / 2), n - subCount);
    for (let j = 0; j < subCount; j += 1) {
      subIndexes.push(mod(keeperIndex + offset + j, n));
    }
  }

  return { order, n, keeperIndex, subIndexes };
}

function teamStateAt(team, changeIndex) {
  const now = slotsAt(team, changeIndex);
  const next = slotsAt(team, changeIndex + 1);

  return {
    name: String(team.name ?? ''),
    order: now.order,
    subCount: subCountFor(now.n),
    keeper: now.keeperIndex < 0 ? null : now.order[now.keeperIndex],
    keeperIndex: now.keeperIndex,
    subs: now.subIndexes.map((i) => now.order[i]),
    subIndexes: now.subIndexes,
    nextKeeper: next.keeperIndex < 0 ? null : next.order[next.keeperIndex],
    nextKeeperIndex: next.keeperIndex,
    nextSubs: next.subIndexes.map((i) => next.order[i])
  };
}

/**
 * The whole engine.
 *
 * rotation(setup, elapsedMs) -> {
 *   intervalMs, changeIndex, msToNextChange, totalChanges,
 *   teams: [{ name, order, subCount,
 *             keeper, keeperIndex, subs, subIndexes,
 *             nextKeeper, nextKeeperIndex, nextSubs }]
 * }
 *
 * `msToNextChange` is in (0, intervalMs]. It reads intervalMs exactly on a
 * change boundary, so the announcement fires on the crossing, never twice.
 * Every player record in the result is a fresh copy. Nothing in `setup` is
 * touched, and nothing the caller does to the result reaches the setup.
 */
export function rotation(setup, elapsedMs) {
  const intervalMs = computeIntervalMs(setup);
  const elapsed = Math.max(0, num(elapsedMs, 0));
  const changeIndex = Math.floor(elapsed / intervalMs);
  const msToNextChange = intervalMs - (elapsed - changeIndex * intervalMs);

  return {
    intervalMs,
    changeIndex,
    msToNextChange,
    totalChanges: totalChangesIn(setup),
    teams: (setup.teams ?? []).map((team) => teamStateAt(team, changeIndex))
  };
}

/* --------------------------------------------------------- roster changes */

function replaceTeam(setup, teamIndex, team) {
  const teams = setup.teams.map((existing, i) => (i === teamIndex ? team : existing));
  return { ...setup, teams };
}

function nextLateId(team, teamIndex) {
  const taken = new Set((team.players ?? []).map((player) => player.id));
  let n = 1;
  while (taken.has(`t${teamIndex}L${n}`)) n += 1;
  return `t${teamIndex}L${n}`;
}

/**
 * Someone turns up after kick-off. Returns a new setup.
 *
 * They go in goal at the very next change. The clock does not move. They then
 * wait a full lap of the new list. The current keeper does not change.
 */
export function addLateArrival(setup, teamIndex, name, elapsedMs) {
  const locked = lockClock(setup);
  const team = locked.teams[teamIndex];
  if (!team) return locked;

  const trimmed = String(name).trim();
  if (trimmed.length === 0) return locked;

  const changeIndex = changeIndexAt(locked, elapsedMs);
  const state = slotsAt(team, changeIndex);
  const player = { id: nextLateId(team, teamIndex), name: trimmed };
  const players = (team.players ?? []).map(copyPlayer);

  let anchor;
  if (state.n === 0) {
    players.push(player);
    anchor = { changeIndex, playerId: player.id };
  } else {
    players.splice(state.keeperIndex + 1, 0, player);
    anchor = { changeIndex, playerId: state.order[state.keeperIndex].id };
  }

  return replaceTeam(locked, teamIndex, { ...team, players, anchor });
}

/**
 * Someone goes home or is injured. Returns a new setup.
 *
 * Their name never comes up again, in goal or on the bench. The current keeper
 * does not change, unless the person who leaves IS the keeper — then the player
 * who was next goes in for the rest of that shift.
 */
export function removePlayer(setup, teamIndex, playerId, elapsedMs) {
  const locked = lockClock(setup);
  const team = locked.teams[teamIndex];
  if (!team) return locked;

  const players = (team.players ?? [])
    .filter((player) => player.id !== playerId)
    .map(copyPlayer);
  if (players.length === (team.players ?? []).length) return locked;

  if (players.length === 0) {
    return replaceTeam(locked, teamIndex, { ...team, players, anchor: null });
  }

  const changeIndex = changeIndexAt(locked, elapsedMs);
  const state = slotsAt(team, changeIndex);
  const keeper = state.order[state.keeperIndex];
  const successor = state.order[mod(state.keeperIndex + 1, state.n)];
  const holdOn = keeper.id === playerId ? successor : keeper;

  return replaceTeam(locked, teamIndex, {
    ...team,
    players,
    anchor: { changeIndex, playerId: holdOn.id }
  });
}
