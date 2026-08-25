/*
 * rotation.js — the rota engine.
 *
 * One pure function. No clock, no stored state, no mutation of its arguments.
 * `rotation(setup, elapsedMs)` always returns the same answer for the same two
 * inputs, so a phone that dies mid-game restores the setup and the kick-off
 * timestamp from localStorage and carries on at the right shift.
 *
 * THE ORDER IS THE RING
 *
 * `team.players` is an ordered list, and that order IS the rotation ring. A
 * person sets it by hand, by dragging. Nothing here sorts it, ever. The
 * dividing line falls after `gameType` names: those players start on the pitch,
 * everyone below the line starts as a sub. The list is the only honest
 * description of the live order, because a late arrival lands in a slot that no
 * rule about names could predict.
 *
 * THE INTERVAL IS DERIVED FROM ROTATIONS, WITH A MANUAL OVERRIDE
 *
 * Nobody can work out an interval that shares the game out evenly. That is
 * arithmetic, so the app does it. `rotations` is how many times each player
 * goes in goal across `gameMinutes`. An integer, default 2, range 1 to 5.
 *
 *     N           the LARGER of the two squads
 *     raw         gameMinutes * 60000 / (N * rotations)
 *     intervalMs  floor(raw / 15000) * 15000, then at least 60000
 *
 * The floor to 15 seconds is for the reader, not for the sum: 2 hours, 7
 * players and 2 rotations is 8.571 minutes, and the screen says 8:30. It
 * floors rather than rounds so the last rotation always finishes inside the
 * game time. The 60-second clamp is a floor under the whole thing — 30 minutes
 * shared 5 ways between 11 players is 32 seconds, which is a scramble and not
 * a shift. It binds at no setting a person would choose.
 *
 * N is the LARGER squad because rotations is a promise, and a promise kept for
 * the bigger squad is kept for the smaller one too. Eight against seven, twice
 * each: the eight get exactly twice and the seven get a little more. The other
 * way round the eight come up short, and short is the failure.
 *
 * `intervalMode: 'manual'` throws all of that away. `intervalMs` is then
 * `subMinutes` in milliseconds, exactly as the old model had it, and
 * `rotationsPerPlayer()` reads the sum backwards to say what the manual number
 * actually buys — 1.7 rotations each, not 2. One slot on the screen, two
 * meanings, and always the true one.
 *
 * `gameMinutes` is no longer reference only. It sets the interval in the
 * default mode. Nothing still happens when it elapses: the rotation carries on
 * for as long as the app is open.
 *
 * THE INTERVAL FREEZES AT KICK-OFF
 *
 * `kickOff()` resolves the interval and writes it onto the setup as
 * `intervalMs`. `rotation()` reads that stored number whenever it is there and
 * derives live only when it is not — which is the setup screen before kick-off,
 * previewing the number as names are typed.
 *
 * It has to freeze because N moves. Somebody turns up at minute twenty, the
 * larger squad goes from seven to eight, and a live derivation would shorten
 * every interval — so the countdown on the screen would jump backwards in the
 * middle of a shift. That is the same reason the deleted `lockClock` existed.
 *
 * The price, stated plainly: once the interval is frozen, "twice each" becomes
 * slightly less than twice for a squad that grew. Seven players over 2 hours
 * gives 8:30; an eighth arrival makes that 8:30 worth 1.76 rotations, not 2.
 * A clock that does not jump is worth more than the last fifth of a shift, and
 * nobody on a pitch is counting. That is the right trade.
 *
 * TWO POINTERS
 *
 * With N players, G on the pitch and C = max(0, N - G) subs:
 *
 *     keeper(k) = ring[(kStart + k) mod N]
 *     subs(k)   = ring[(sStart + k + j) mod N]   for j = 0 .. C-1
 *
 * Both pointers advance by exactly one per change. At kick-off `sStart` is G,
 * the dividing line, so change 0 is exactly what the setup screen showed. Over
 * one lap of N changes every player keeps goal once, sits C times and plays the
 * rest. A squad smaller than G has C = 0 and simply plays short. Nothing about
 * that is an error.
 *
 * Because both pointers move at the same speed, the gap between them never
 * changes. Write it `o = (sStart - kStart) mod N`. That one number decides
 * whether the rota is legal.
 *
 * THE TWO HARD RULES, AND THE ONE NUMBER THAT KEEPS THEM
 *
 * A player must never come out of goal and become a sub at the next change, and
 * a sub must never go straight into goal. Measure every slot from the keeper.
 * The subs sit at o, o+1 ... o+C-1. Then:
 *
 *   - the keeper is also a sub          if some o+j = 0
 *   - the keeper sits down next change  if some o+j = N-1
 *   - a sub goes into goal next change  if some o+j = 1
 *
 * So the run of C slots has to miss 0, 1 and N-1, and a run of C consecutive
 * slots misses all three exactly when
 *
 *     2 <= o <= N - 1 - C
 *
 * At kick-off o = G - kStart, so that condition reads `1 <= kStart <= G - 2`.
 * The two ends of the starting line-up are the only two illegal starts, and a
 * sub can never start in goal either — that falls out of the same inequality
 * rather than needing a rule of its own. `legalStartKeepers()` returns the rest.
 * `test.js` proves both halves: the legal starts never break a rule over three
 * laps, and the excluded ones break exactly the rule the arithmetic names.
 *
 * The window is empty when G <= 2, because a run of one slot cannot miss 0, 1
 * and N-1 at once. There the whole starting line-up is offered and one of the
 * two rules gives way. The app's minimum game type is 4, so this is a guard and
 * not a path.
 *
 * THE START IS DRAWN ONCE AND WRITTEN DOWN
 *
 * `kickOff()` draws the starting keeper at random from the legal starts and
 * stores it, so `rotation()` stays pure and a restored phone gets the same
 * answer as the one that died. A person can override the draw by tapping a
 * name: `isLegalStartKeeper()` lets the interface refuse the tap, and
 * `setStartKeeper()` moves it to the nearest legal name if the interface would
 * rather adjust than refuse.
 *
 * The draw uses 1 .. G-2 even when C is 0 and no rule can break yet. A team of
 * exactly G has no bench until somebody turns up, and a start that is legal
 * only while nobody turns up is not legal. It costs nothing: at a game type of
 * 4 there are still two names to draw from.
 *
 * WHY THE ANCHOR SURVIVED, WITH A SECOND POINTER IN IT
 *
 * `team.anchor = { changeIndex, keeperIndex, subIndex }` reads "at this change
 * the keeper is this slot and the bench starts at that one". At kick-off it is
 * `{ 0, kStart, G }`, which is the setup screen written down directly, and
 * everything counts forward from it. A roster change writes a new anchor at the
 * change it happens on, so no query ever has to reason about a squad size that
 * no longer exists.
 *
 * The old anchor held a player id, because an index moves under a roster
 * change. It holds indexes now. Both roster helpers rewrite the anchor against
 * the new list in the same breath as they change it, so the id bought nothing —
 * and the bench pointer has no player to name in any case. It is a position,
 * not a person.
 *
 * THE TWO ROSTER CHANGES ARE SETUP REWRITES, NOT HISTORY
 *
 * `addLateArrival()` and `removePlayer()` each return a NEW setup. There is no
 * event log to replay. The app writes the returned setup to localStorage and
 * everything stays a pure function of (setup, elapsedMs). Undo is free: keep
 * the previous setup object and put it back.
 *
 * Late arrival. The new player goes in at the front of the bench and the anchor
 * keeps the same o. Nobody on the pitch is disturbed: the newcomer is a sub for
 * the rest of the current change and comes on at the next one, which is what
 * actually happens when somebody jogs up mid-game. N and C both grow by one, so
 * `2 <= o <= N - 1 - C` reads the same as before and the rota stays legal by
 * construction. A team still short of `gameType` has no bench, so the newcomer
 * simply walks on instead, and the one case where o has to move is the arrival
 * that ends a spell of playing short — see `safeOffset()`.
 *
 * Gone home. The player drops out of the list and the anchor keeps the same o,
 * measured from whoever is in goal once the dust settles. If the person who
 * leaves IS the keeper, the player who was due next goes in for the rest of
 * that shift. N and C both fall by one, so again the condition is unchanged.
 * The bench gives up its far end, so when the leaver was on the pitch a sub
 * comes on at once to fill the hole — sometimes the one who has sat longest,
 * sometimes the one who has just sat down, depending where the leaver stood.
 * Always taking it from the near end would be fairer by a minute, but it moves
 * o out of the legal window, and a hard rule beats a minute of bench time.
 *
 * WHAT THE DISPLAY GETS
 *
 * Per team: `keeper`, `subs` and `onPitch` — the players who are neither — and
 * `nextKeeper`, `nextSubs` for the change to come. Arrows come from `comingOn`
 * and `goingOff`, which are those two sets differenced for you. With a bench
 * each list holds exactly one name, and `comingOn` is always `subs[0]` while
 * `goingOff` is always the last of `nextSubs`. With no bench both are empty.
 * The keeper handover is in neither list, because coming out of goal is not
 * coming off the pitch.
 *
 * A NOTE ON ASKING ABOUT THE PAST
 *
 * A setup describes the roster as it is now. After a roster change, a query for
 * an earlier `elapsedMs` returns what that change WOULD have been under the
 * present roster, not what the screen said at the time. The engine keeps no
 * history, by design. Only the current change and the next one are ever shown.
 */

export const MS_PER_MINUTE = 60000;
export const MIN_GAME_TYPE = 4;
export const MAX_GAME_TYPE = 11;
export const DEFAULT_GAME_TYPE = 6;
export const DEFAULT_SUB_MINUTES = 10;
export const DEFAULT_GAME_MINUTES = 120;
export const DEFAULT_TEAM_NAMES = ['Bibs', 'No bibs'];

export const MIN_ROTATIONS = 1;
export const MAX_ROTATIONS = 5;
export const DEFAULT_ROTATIONS = 2;
export const DEFAULT_INTERVAL_MODE = 'rotations';

/* the derived interval lands on a 15-second grid so the number reads cleanly */
export const INTERVAL_GRAIN_MS = 15000;
/* and never below a minute — under that a shift is a scramble, not a shift */
export const MIN_INTERVAL_MS = 60000;

/* ---------------------------------------------------------------- helpers */

function mod(a, b) {
  return ((a % b) + b) % b;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function copyPlayer(player) {
  return { id: player.id, name: player.name };
}

/* ------------------------------------------------------------------ setup */

/** Players on the pitch per team. Read defensively — a stored setup is data. */
export function gameTypeOf(setup) {
  return Math.max(1, Math.floor(num(setup && setup.gameType, DEFAULT_GAME_TYPE)));
}

/** The interval, in whole minutes. */
export function subMinutesOf(setup) {
  return Math.max(1, Math.floor(num(setup && setup.subMinutes, DEFAULT_SUB_MINUTES)));
}

/** The whole game, in whole minutes. In the default mode this sets the interval. */
export function gameMinutesOf(setup) {
  return Math.max(0, Math.floor(num(setup && setup.gameMinutes, DEFAULT_GAME_MINUTES)));
}

/** How many times each player goes in goal across the game time. */
export function rotationsOf(setup) {
  return clamp(Math.floor(num(setup && setup.rotations, DEFAULT_ROTATIONS)), MIN_ROTATIONS, MAX_ROTATIONS);
}

/** `'rotations'` derives the interval. `'manual'` uses `subMinutes` instead. */
export function intervalModeOf(setup) {
  return (setup && setup.intervalMode) === 'manual' ? 'manual' : DEFAULT_INTERVAL_MODE;
}

/**
 * N — the larger of the two squads.
 *
 * The bigger squad is the one the promise has to be kept for. Give it exactly
 * its rotations and the smaller squad gets a little more, which is a squad
 * being lucky. Size it off the smaller squad and the bigger one comes up short.
 */
export function squadSizeOf(setup) {
  return ((setup && setup.teams) ?? []).reduce(
    (most, team) => Math.max(most, ((team && team.players) ?? []).length),
    0
  );
}

/** Subs on the bench. A squad short of `gameType` has none and plays short. */
export function subCountFor(squadSize, gameType) {
  return Math.max(0, Math.floor(num(squadSize, 0)) - Math.max(1, Math.floor(num(gameType, DEFAULT_GAME_TYPE))));
}

/**
 * Build a setup from the order a person dragged.
 *
 * createSetup({
 *   gameType: 6,
 *   gameMinutes: 120,
 *   rotations: 2,
 *   intervalMode: 'rotations',
 *   subMinutes: 10,
 *   teams: [{ name: 'Bibs', players: ['Zoe', 'Alex', 'Sam'] }, { ... }]
 * })
 *
 * Call it again on every keystroke and every drag while the setup screen is
 * open. The ids come from the list position, so the result is stable and pure,
 * and a drag renames nobody. The starting keeper is not drawn here — that
 * happens once, at `kickOff()`.
 *
 * `intervalMs` is optional and is normally absent: a fresh setup derives its
 * interval live so the setup screen can preview it. Pass it to carry a frozen
 * interval forward — a setup rebuilt for an edit mid-game keeps the number the
 * kick-off wrote, so the countdown does not move under an edit either.
 */
export function createSetup(input = {}) {
  const gameType = clamp(Math.floor(num(input.gameType, DEFAULT_GAME_TYPE)), MIN_GAME_TYPE, MAX_GAME_TYPE);
  const subMinutes = Math.max(1, Math.floor(num(input.subMinutes, DEFAULT_SUB_MINUTES)));
  const gameMinutes = Math.max(0, Math.floor(num(input.gameMinutes, DEFAULT_GAME_MINUTES)));
  const rotations = rotationsOf(input);
  const intervalMode = intervalModeOf(input);
  const frozen = frozenIntervalOf(input);
  const teamsIn = Array.isArray(input.teams) ? input.teams : [];

  const teams = teamsIn.map((team, teamIndex) => {
    const players = (Array.isArray(team.players) ? team.players : [])
      .map((name) => String(name).trim())
      .filter((name) => name.length > 0)
      .map((name, i) => ({ id: `t${teamIndex}p${i}`, name }));

    return {
      name: String(team.name ?? DEFAULT_TEAM_NAMES[teamIndex] ?? `Team ${teamIndex + 1}`),
      players,
      anchor: null
    };
  });

  const setup = { gameType, subMinutes, gameMinutes, rotations, intervalMode, teams };
  if (frozen !== null) setup.intervalMs = frozen;
  return setup;
}

/* ------------------------------------------------------------- the interval */

/** The interval the kick-off wrote down, or null if none has been written. */
function frozenIntervalOf(setup) {
  const stored = Number(setup && setup.intervalMs);
  return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : null;
}

/**
 * The interval `rotations` asks for: the game time, cut N * rotations ways,
 * floored to 15 seconds and never under a minute. See the header.
 */
export function derivedIntervalMs(setup) {
  const n = Math.max(1, squadSizeOf(setup));
  const raw = (gameMinutesOf(setup) * MS_PER_MINUTE) / (n * rotationsOf(setup));
  return Math.max(MIN_INTERVAL_MS, Math.floor(raw / INTERVAL_GRAIN_MS) * INTERVAL_GRAIN_MS);
}

/** The interval `subMinutes` asks for. Whole minutes, exactly as set. */
export function manualIntervalMs(setup) {
  return subMinutesOf(setup) * MS_PER_MINUTE;
}

/** What the two settings work out to, before any freeze is considered. */
export function resolveIntervalMs(setup) {
  return intervalModeOf(setup) === 'manual' ? manualIntervalMs(setup) : derivedIntervalMs(setup);
}

/**
 * The interval the clock actually runs on.
 *
 * The frozen number wins whenever it is there, which is from kick-off onwards.
 * Before then there is nothing stored and this derives live, so the setup
 * screen can show the number moving as names are typed.
 */
export function computeIntervalMs(setup) {
  return frozenIntervalOf(setup) ?? resolveIntervalMs(setup);
}

/** True once the interval is written down and a roster change cannot move it. */
export function isIntervalFrozen(setup) {
  return frozenIntervalOf(setup) !== null;
}

/**
 * The sum read backwards: how many rotations the live interval actually buys.
 *
 * One decimal place. This is what a manual interval is worth — `10 minutes` is
 * 1.7 rotations each, not 2 — and it is what a frozen interval is worth after
 * a squad has grown. Null when there is nobody to rotate.
 */
export function rotationsPerPlayer(setup) {
  const n = squadSizeOf(setup);
  if (n < 1) return null;
  const intervalMs = computeIntervalMs(setup);
  if (!(intervalMs > 0)) return null;
  return Math.round(((gameMinutesOf(setup) * MS_PER_MINUTE) / (n * intervalMs)) * 10) / 10;
}

/** Which change the game is on. Counts past `gameMinutes` and never stops. */
export function changeIndexAt(setup, elapsedMs) {
  const elapsed = Math.max(0, num(elapsedMs, 0));
  return Math.floor(elapsed / computeIntervalMs(setup));
}

/* --------------------------------------------------- the starting keeper */

/** The legal starting slots for a squad of n with g on the pitch. */
function legalStartsFor(n, g) {
  if (n <= 0) return [];
  const starters = Math.min(g, n);
  const all = [];
  for (let i = 0; i < starters; i += 1) all.push(i);
  const window = all.filter((i) => i >= 1 && i <= g - 2);
  return window.length > 0 ? window : all;
}

/**
 * Which players may start in goal. Indexes into `team.players`.
 *
 * Everyone who starts on the pitch except the two ends of the line-up. The
 * first would come out of goal into the bench one change later; the last would
 * be replaced in goal by a sub. See the header for the arithmetic.
 */
export function legalStartKeepers(setup, teamIndex) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return [];
  return legalStartsFor((team.players ?? []).length, gameTypeOf(setup));
}

/** Can this player start in goal? Ask before you offer the tap. */
export function isLegalStartKeeper(setup, teamIndex, index) {
  return legalStartKeepers(setup, teamIndex).includes(Math.floor(num(index, -1)));
}

/** The closest slot that is legal, for an interface that adjusts a tap rather than refusing it. */
export function nearestLegalStartKeeper(setup, teamIndex, index) {
  const legal = legalStartKeepers(setup, teamIndex);
  if (legal.length === 0) return -1;
  const wanted = Math.floor(num(index, 0));
  let best = legal[0];
  for (const candidate of legal) {
    if (Math.abs(candidate - wanted) < Math.abs(best - wanted)) best = candidate;
  }
  return best;
}

function startAnchor(keeperIndex, n, g) {
  return { changeIndex: 0, keeperIndex, subIndex: mod(g, n) };
}

/**
 * A person taps a name to choose the starting keeper. Returns a new setup.
 *
 * An illegal tap moves to the nearest legal slot, so this module never stores
 * an anchor that breaks one of the two rules. Call `isLegalStartKeeper()` first
 * if the interface would rather refuse the tap outright.
 */
export function setStartKeeper(setup, teamIndex, index) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return setup;
  const n = (team.players ?? []).length;
  if (n === 0) return setup;
  const keeperIndex = nearestLegalStartKeeper(setup, teamIndex, index);
  return replaceTeam(setup, teamIndex, { ...team, anchor: startAnchor(keeperIndex, n, gameTypeOf(setup)) });
}

/**
 * Two things are settled here, once, and written down: the starting keeper for
 * any team that has not had one chosen, and the interval. Returns a new setup.
 *
 * Idempotent both ways. A team that already has an anchor keeps it, so a tap
 * before kick-off survives, and an interval already frozen is left alone.
 *
 * The draw is the one impure moment in the module and it happens once. After
 * this call the answers are in the setup and everything downstream is a pure
 * function of (setup, elapsedMs). Pass `random` to make it deterministic.
 *
 * Freezing the interval is what stops the countdown jumping when a late
 * arrival changes N. It costs a squad that grows a little of its last
 * rotation. See the header.
 */
export function kickOff(setup, random = Math.random) {
  const g = gameTypeOf(setup);
  const teams = ((setup && setup.teams) ?? []).map((team, teamIndex) => {
    if (team.anchor) return team;
    const n = (team.players ?? []).length;
    const legal = legalStartsFor(n, g);
    if (legal.length === 0) return { ...team, anchor: null };
    const roll = clamp(num(random(), 0), 0, 0.999999);
    return { ...team, anchor: startAnchor(legal[Math.floor(roll * legal.length)], n, g) };
  });
  return { ...setup, teams, intervalMs: computeIntervalMs(setup) };
}

/* ----------------------------------------------------------------- engine */

/**
 * Push an offset into the legal window. Every anchor this module writes goes
 * through here, so the two rules hold by construction and not by the caller's
 * discipline.
 *
 * It is a no-op on all but one path. A legal start lands inside the window. A
 * removal drops N and C together, which leaves the window exactly where it was.
 * So does an arrival — unless the team has been under `gameType` and has just
 * climbed back over it, because a team with no bench has no window to sit in
 * and its offset drifts while it is short. The arrival that hands that team a
 * bench again pulls the offset back in. That bench is one seat wide and the
 * newcomer is the one sitting in it, so nobody else on the pitch notices.
 */
function safeOffset(n, c, offset) {
  if (n <= 0) return 0;
  const o = mod(offset, n);
  if (c <= 0) return o;
  const high = n - 1 - c;
  if (high < 2) return o;
  return clamp(o, 2, high);
}

function resolveAnchor(team, g) {
  const n = (team.players ?? []).length;
  if (n === 0) return null;
  const stored = team.anchor;
  if (stored && Number.isFinite(Number(stored.keeperIndex))) {
    return {
      changeIndex: Math.floor(num(stored.changeIndex, 0)),
      keeperIndex: mod(Math.floor(num(stored.keeperIndex, 0)), n),
      subIndex: mod(Math.floor(num(stored.subIndex, g)), n)
    };
  }
  return startAnchor(legalStartsFor(n, g)[0] ?? 0, n, g);
}

function slotsAt(team, changeIndex, g) {
  const order = (team.players ?? []).map(copyPlayer);
  const n = order.length;
  if (n === 0) {
    return { order, n, keeperIndex: -1, subIndexes: [], onPitchIndexes: [], offset: 0 };
  }

  const anchor = resolveAnchor(team, g);
  const step = changeIndex - anchor.changeIndex;
  const keeperIndex = mod(anchor.keeperIndex + step, n);
  const subStart = mod(anchor.subIndex + step, n);

  const subIndexes = [];
  for (let j = 0; j < subCountFor(n, g); j += 1) subIndexes.push(mod(subStart + j, n));

  const off = new Set(subIndexes);
  off.add(keeperIndex);
  const onPitchIndexes = [];
  for (let i = 0; i < n; i += 1) if (!off.has(i)) onPitchIndexes.push(i);

  return {
    order,
    n,
    keeperIndex,
    subIndexes,
    onPitchIndexes,
    offset: mod(anchor.subIndex - anchor.keeperIndex, n)
  };
}

function pick(state, indexes) {
  return indexes.map((i) => state.order[i]);
}

function teamStateAt(team, changeIndex, g) {
  const now = slotsAt(team, changeIndex, g);
  const next = slotsAt(team, changeIndex + 1, g);

  const nowSubs = new Set(now.subIndexes.map((i) => now.order[i].id));
  const nextSubs = new Set(next.subIndexes.map((i) => next.order[i].id));

  return {
    name: String(team.name ?? ''),
    order: now.order,
    subCount: subCountFor(now.n, g),

    keeper: now.keeperIndex < 0 ? null : now.order[now.keeperIndex],
    keeperIndex: now.keeperIndex,
    subs: pick(now, now.subIndexes),
    subIndexes: now.subIndexes,
    onPitch: pick(now, now.onPitchIndexes),
    onPitchIndexes: now.onPitchIndexes,

    nextKeeper: next.keeperIndex < 0 ? null : next.order[next.keeperIndex],
    nextKeeperIndex: next.keeperIndex,
    nextSubs: pick(next, next.subIndexes),
    nextSubIndexes: next.subIndexes,

    comingOn: pick(now, now.subIndexes.filter((i) => !nextSubs.has(now.order[i].id))),
    goingOff: pick(next, next.subIndexes.filter((i) => !nowSubs.has(next.order[i].id)))
  };
}

/**
 * The whole engine.
 *
 * rotation(setup, elapsedMs) -> {
 *   intervalMs, changeIndex, msToNextChange, elapsedMs, gameMs, gameType,
 *   rotations, intervalMode, frozen,
 *   teams: [{ name, order, subCount,
 *             keeper, keeperIndex, subs, subIndexes, onPitch, onPitchIndexes,
 *             nextKeeper, nextKeeperIndex, nextSubs, nextSubIndexes,
 *             comingOn, goingOff }]
 * }
 *
 * `msToNextChange` is in (0, intervalMs]. It reads intervalMs exactly on a
 * change boundary, so the announcement fires on the crossing, never twice.
 * `intervalMs` is the frozen number once kick-off has written one and the live
 * derivation before then. `gameMs` is the whole game and stops nothing. Every
 * player record in the result is a fresh copy: nothing in `setup` is touched,
 * and nothing the caller does to the result reaches the setup.
 */
export function rotation(setup, elapsedMs) {
  const intervalMs = computeIntervalMs(setup);
  const elapsed = Math.max(0, num(elapsedMs, 0));
  const changeIndex = Math.floor(elapsed / intervalMs);
  const gameType = gameTypeOf(setup);

  return {
    intervalMs,
    changeIndex,
    msToNextChange: intervalMs - (elapsed - changeIndex * intervalMs),
    elapsedMs: elapsed,
    gameMs: gameMinutesOf(setup) * MS_PER_MINUTE,
    gameType,
    rotations: rotationsOf(setup),
    intervalMode: intervalModeOf(setup),
    frozen: isIntervalFrozen(setup),
    teams: ((setup && setup.teams) ?? []).map((team) => teamStateAt(team, changeIndex, gameType))
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

function reAnchor(setup, teamIndex, team, players, keeperIndex, changeIndex, offset) {
  const n = players.length;
  const o = safeOffset(n, subCountFor(n, gameTypeOf(setup)), offset);
  return replaceTeam(setup, teamIndex, {
    ...team,
    players,
    anchor: { changeIndex, keeperIndex, subIndex: mod(keeperIndex + o, n) }
  });
}

/**
 * Someone turns up after kick-off. Returns a new setup.
 *
 * They join the front of the bench and come on at the next change. Nobody on
 * the pitch moves, the keeper does not change, and the clock does not move. A
 * team still short of `gameType` has no bench, so they walk straight on.
 */
export function addLateArrival(setup, teamIndex, name, elapsedMs) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return setup;

  const trimmed = String(name).trim();
  if (trimmed.length === 0) return setup;

  const g = gameTypeOf(setup);
  const changeIndex = changeIndexAt(setup, elapsedMs);
  const now = slotsAt(team, changeIndex, g);
  const player = { id: nextLateId(team, teamIndex), name: trimmed };
  const players = (team.players ?? []).map(copyPlayer);

  if (now.n === 0) {
    players.push(player);
    return reAnchor(setup, teamIndex, team, players, 0, changeIndex, 0);
  }

  const grown = now.n + 1;
  const offset = safeOffset(grown, subCountFor(grown, g), now.offset);
  const at = mod(now.keeperIndex + offset, now.n);
  players.splice(at, 0, player);
  const keeperIndex = now.keeperIndex < at ? now.keeperIndex : now.keeperIndex + 1;
  return reAnchor(setup, teamIndex, team, players, keeperIndex, changeIndex, offset);
}

/**
 * Someone goes home or is injured. Returns a new setup.
 *
 * Their name never comes up again, in goal or on the bench. The current keeper
 * does not change, unless the person who leaves IS the keeper — then the player
 * who was due next goes in for the rest of that shift. The clock does not move.
 */
export function removePlayer(setup, teamIndex, playerId, elapsedMs) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return setup;

  const before = team.players ?? [];
  const players = before.filter((player) => player.id !== playerId).map(copyPlayer);
  if (players.length === before.length) return setup;
  if (players.length === 0) return replaceTeam(setup, teamIndex, { ...team, players, anchor: null });

  const g = gameTypeOf(setup);
  const changeIndex = changeIndexAt(setup, elapsedMs);
  const now = slotsAt(team, changeIndex, g);
  const keeper = now.order[now.keeperIndex];
  const successor = now.order[mod(now.keeperIndex + 1, now.n)];
  const holdOn = keeper.id === playerId ? successor : keeper;
  const keeperIndex = players.findIndex((player) => player.id === holdOn.id);

  return reAnchor(setup, teamIndex, team, players, keeperIndex, changeIndex, now.offset);
}
