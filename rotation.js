/*
 * rotation.js — the rota engine.
 *
 * One pure function. No clock, no stored state, no mutation of its arguments.
 * `rotation(setup, elapsedMs)` always returns the same answer for the same two
 * inputs, so a phone that dies mid-game restores the setup and the kick-off
 * timestamp from localStorage and carries on at the right shift.
 *
 * ENTRY ORDER DECIDES NOTHING. THE RING IS DRAWN
 *
 * `team.players` is still an ordered list and that order IS the rotation ring.
 * What changed is where the order comes from. Nobody drags it any more and
 * there is no dividing line on the setup screen. Names are typed in whatever
 * order people arrive, and at kick-off the whole list is shuffled. The first
 * `gameType` names in the drawn ring start on the pitch, one of them is drawn
 * as the first keeper, and the rest of the ring is the bench.
 *
 * The list stays the ring after that, because a late arrival lands in a slot
 * that no rule about names could predict, and because the stored order is the
 * only honest description of the live order. Two flags bend the draw, and both
 * are applied when the ring is written, never at read time:
 *
 *     fixedGoalie   this player is in goal all game and never sits.
 *     late          this player sorts to the end of the ring.
 *
 * THE INTERVAL IS DERIVED FROM ROTATIONS. THERE IS NO OVERRIDE
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
 * A setup stored by an older build may carry `intervalMode: 'manual'` and a
 * `subMinutes`. Both are read and ignored: an old setup behaves as
 * `rotations` and nothing throws. A game already running keeps its frozen
 * `intervalMs`, so a phone restored mid-game does not change pace under the
 * person holding it.
 *
 * `rotationsPerPlayer()` reads the same sum backwards, to say what a frozen
 * interval is worth once the squad it was worked out for has changed size.
 *
 * THE THREE SETTINGS CYCLE AND WRAP, IN ONE PLACE
 *
 *     gameType      4 .. 11, step 1,  default 6
 *     rotations     1 .. 5,  step 1,  default 2
 *     gameMinutes  30 .. 150, step 15, default 120
 *
 * A tap on a setting calls `cycle(kind, value)`. It steps one place and wraps
 * from the top back to the bottom, so the interface never does arithmetic and
 * the wrap has exactly one home. A value off the grid is clamped into range
 * first and then stepped; a value that is not a number returns the default.
 *
 * `createSetup()` does NOT apply the `gameMinutes` range. A stored setup is
 * data and may hold any duration an older build wrote. Only the tap is bounded.
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
 * middle of a shift.
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
 * so the bench is the tail of the drawn ring and the pitch is its head. Over
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
 * The two ends of the drawn starting line-up are the only two illegal starts,
 * and a sub can never start in goal either — that falls out of the same
 * inequality rather than needing a rule of its own. `legalStartKeepers()`
 * returns the rest, and the random draw draws from exactly that list.
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
 * Two draws happen in `kickOff()` and nowhere else: the ring, by a Fisher-Yates
 * shuffle of the typed list, and the starting keeper, uniformly from the legal
 * starts. Both are written into the setup — the ring as the new `players`
 * order, the keeper as the anchor — so `rotation()` stays pure and a restored
 * phone gets the same answer as the one that died. There is no tap that
 * overrides the draw. Kick off again to redraw.
 *
 * The draw uses 1 .. G-2 even when C is 0 and no rule can break yet. A team of
 * exactly G has no bench until somebody turns up, and a start that is legal
 * only while nobody turns up is not legal. It costs nothing: at a game type of
 * 4 there are still two names to draw from.
 *
 * A FIXED GOALIE STOPS ONE POINTER AND SHORTENS THE OTHER
 *
 * `player.fixedGoalie` means that player is in goal for the whole game and
 * never sits. The keeper pointer stops. The sub pointer keeps moving one place
 * per change, but around the ring WITHOUT the goalie in it — M = N - 1 seats —
 * so the goalie can never be drawn as a sub and everybody else still takes an
 * even turn on the bench. C is unchanged at max(0, N - G): the pitch still
 * holds G, one of whom is the goalie.
 *
 * The two hard rules are then trivially true, and it is worth saying why
 * rather than assuming it. Both rules are about a player crossing between goal
 * and bench. Nobody enters or leaves goal at any change, so no crossing exists.
 * The only remaining way to break them is for the keeper to also be a sub, and
 * the goalie is not in the ring the sub pointer walks. `test.js` asserts this
 * over three laps rather than taking it on trust.
 *
 * At most one fixed goalie per team. If a stored setup somehow carries two,
 * the FIRST in `team.players` wins and the engine clears the flag from the
 * others the next time it writes that team. Reads use the same first-wins rule,
 * so a hand-edited setup never behaves differently from a written one.
 *
 * Unlike `late`, this flag is read live: a raw flip takes effect at once and is
 * legal, but the bench lands wherever the stored pointer happens to point.
 * `setFixedGoalie()` is the route that also cuts the pitch.
 *
 * LATE IS A PLACE IN THE RING, NOT AN EXCLUSION
 *
 * `player.late` means the person is not here yet at kick-off. They sort to the
 * end of the ring, which puts them on the bench at change 0 and makes their
 * turn in goal the furthest away of anyone's — but they are in the ring, so if
 * the game runs long enough their turn comes. Several late players keep their
 * order relative to each other: the sort is stable.
 *
 * The flag is reversible mid-game through `setLate()`, which re-sorts the ring
 * and re-anchors on the same change, so the person in goal right now is still
 * in goal right now. The bench can move under that, because a ring that has
 * been re-cut has to put the bench somewhere; the keeper is the promise, not
 * the bench. Flipping the raw boolean without calling `setLate()` changes
 * nothing at all — the ring is stored, not derived — so neither route can move
 * the keeper.
 *
 * `setFixedGoalie()` is the same shape and carries a weaker promise, because
 * naming a goalie mid-game is a decision about the whole rest of the game and
 * not a correction: turning it on makes that player the keeper at once and
 * re-cuts the pitch, and turning it off leaves them in goal for the current
 * change and hands one outfielder's shirt to a sub.
 *
 * WHY THE ANCHOR SURVIVED, WITH A SECOND POINTER IN IT
 *
 * `team.anchor = { changeIndex, keeperIndex, subIndex }` reads "at this change
 * the keeper is this slot and the bench starts at that one". At kick-off it is
 * `{ 0, kStart, G }`, which is the drawn line-up written down directly, and
 * everything counts forward from it. A roster change writes a new anchor at the
 * change it happens on, so no query ever has to reason about a squad size that
 * no longer exists.
 *
 * One field changes meaning for a team with a fixed goalie, and only one.
 * `keeperIndex` is then the goalie's own slot and never moves, and `subIndex`
 * counts in the ring WITHOUT the goalie — 0 .. M-1 — because that is the ring
 * the sub pointer walks. Everything else reads the same.
 *
 * THE ROSTER CHANGES ARE SETUP REWRITES, NOT HISTORY
 *
 * `addLateArrival()`, `removePlayer()`, `setLate()` and `setFixedGoalie()` each
 * return a NEW setup. There is no event log to replay. The app writes the
 * returned setup to localStorage and everything stays a pure function of
 * (setup, elapsedMs). Undo is free: keep the previous setup object and put it
 * back.
 *
 * Late arrival. The new player goes in at the front of the bench and the anchor
 * keeps the same o. Nobody on the pitch is disturbed: the newcomer is a sub for
 * the rest of the current change and comes on at the next one, which is what
 * actually happens when somebody jogs up mid-game. N and C both grow by one, so
 * `2 <= o <= N - 1 - C` reads the same as before and the rota stays legal by
 * construction. A team still short of `gameType` has no bench, so the newcomer
 * simply walks on instead, and the one case where o has to move is the arrival
 * that ends a spell of playing short — see `safeOffset()`. A team with a fixed
 * goalie does the same thing one ring in, and the goalie never notices.
 *
 * Gone home. The player drops out of the list and the anchor keeps the same o,
 * measured from whoever is in goal once the dust settles. If the person who
 * leaves IS the keeper, the player who was due next goes in for the rest of
 * that shift. N and C both fall by one, so again the condition is unchanged.
 * The bench gives up its far end, so when the leaver was on the pitch a sub
 * comes on at once to fill the hole. Always taking it from the near end would
 * be fairer by a minute, but it moves o out of the legal window, and a hard
 * rule beats a minute of bench time.
 *
 * If the person who leaves is the FIXED goalie, the team has no fixed goalie
 * any more and goes back to the ordinary two-pointer rota from that change.
 * The pitch is kept exactly as it stands and the shirt goes to the outfielder
 * two slots before the bench, which is the choice that lands o on 2 and so
 * cannot be illegal.
 *
 * WHAT THE DISPLAY GETS
 *
 * Per team: the whole squad in ring order as `order`, then `keeper`, `subs`
 * and `onPitch` — the players who are neither — and `nextKeeper`, `nextSubs`
 * for the change to come. Every one of those also comes as indexes into
 * `order`, so a column that lists the squad can mark the next keeper and the
 * next subs without arithmetic. `fixedGoalie` is the player or null and
 * `hasFixedGoalie` is the flag, because that team is drawn differently.
 *
 * Arrows come from `comingOn` and `goingOff`, which are the two sub sets
 * differenced for you. With a bench each list holds exactly one name, and
 * `comingOn` is always `subs[0]` while `goingOff` is always the last of
 * `nextSubs`. With no bench both are empty. The keeper handover is in neither
 * list, because coming out of goal is not coming off the pitch.
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
export const DEFAULT_TEAM_NAMES = ['Bibs', 'No bibs'];

export const MIN_ROTATIONS = 1;
export const MAX_ROTATIONS = 5;
export const DEFAULT_ROTATIONS = 2;

export const MIN_GAME_MINUTES = 30;
export const MAX_GAME_MINUTES = 150;
export const GAME_MINUTES_STEP = 15;
export const DEFAULT_GAME_MINUTES = 120;

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
  return {
    id: player.id,
    name: player.name,
    fixedGoalie: player.fixedGoalie === true,
    late: player.late === true
  };
}

/** The one fixed goalie, first-wins. -1 when the team has none. */
function fixedGoalieIndexOf(players) {
  for (let i = 0; i < players.length; i += 1) {
    if (players[i] && players[i].fixedGoalie === true) return i;
  }
  return -1;
}

/** Clear the flag from every fixed goalie but the first. Runs on every write. */
function oneFixedGoalie(players) {
  const at = fixedGoalieIndexOf(players);
  if (at < 0) return players;
  return players.map((player, i) =>
    player.fixedGoalie === true && i !== at ? { ...player, fixedGoalie: false } : player
  );
}

/**
 * The ring order the flags ask for: the fixed goalie first, the late players
 * last, everybody else where they already were. Stable, so several late
 * players keep their order relative to each other.
 */
function ringOrder(players) {
  const at = fixedGoalieIndexOf(players);
  return players
    .map((player, i) => ({ player, i, key: i === at ? -1 : player.late === true ? 1 : 0 }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((entry) => entry.player);
}

/** Fisher-Yates, on a copy, off an injected random. */
function shuffle(list, random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(clamp(num(random(), 0), 0, 0.999999) * (i + 1));
    const held = out[i];
    out[i] = out[j];
    out[j] = held;
  }
  return out;
}

/* ------------------------------------------------------- the three settings */

const CYCLES = {
  gameType: { min: MIN_GAME_TYPE, max: MAX_GAME_TYPE, step: 1, fallback: DEFAULT_GAME_TYPE },
  rotations: { min: MIN_ROTATIONS, max: MAX_ROTATIONS, step: 1, fallback: DEFAULT_ROTATIONS },
  gameMinutes: {
    min: MIN_GAME_MINUTES,
    max: MAX_GAME_MINUTES,
    step: GAME_MINUTES_STEP,
    fallback: DEFAULT_GAME_MINUTES
  }
};

/**
 * One tap on a setting. Steps one place and wraps from the top to the bottom.
 *
 * `kind` is 'gameType', 'rotations' or 'gameMinutes'. A value off the grid is
 * clamped into range and then stepped. A value that is not a number returns
 * that setting's default without stepping. An unknown kind returns the value
 * untouched, because a setting this module does not own is not its business.
 */
export function cycle(kind, value) {
  const range = CYCLES[kind];
  if (!range) return value;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return range.fallback;
  const places = Math.floor((range.max - range.min) / range.step) + 1;
  const at = Math.round((clamp(raw, range.min, range.max) - range.min) / range.step);
  return range.min + mod(at + 1, places) * range.step;
}

export function cycleGameType(value) {
  return cycle('gameType', value);
}

export function cycleRotations(value) {
  return cycle('rotations', value);
}

export function cycleGameMinutes(value) {
  return cycle('gameMinutes', value);
}

/* ------------------------------------------------------------------ setup */

/** Players on the pitch per team. Read defensively — a stored setup is data. */
export function gameTypeOf(setup) {
  return Math.max(1, Math.floor(num(setup && setup.gameType, DEFAULT_GAME_TYPE)));
}

/** The whole game, in whole minutes. This is one half of the interval sum. */
export function gameMinutesOf(setup) {
  return Math.max(0, Math.floor(num(setup && setup.gameMinutes, DEFAULT_GAME_MINUTES)));
}

/** How many times each player goes in goal across the game time. */
export function rotationsOf(setup) {
  return clamp(Math.floor(num(setup && setup.rotations, DEFAULT_ROTATIONS)), MIN_ROTATIONS, MAX_ROTATIONS);
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

/** The team's fixed goalie, as a copy, or null. First-wins if a setup has two. */
export function fixedGoalieOf(setup, teamIndex) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return null;
  const players = team.players ?? [];
  const at = fixedGoalieIndexOf(players);
  return at < 0 ? null : copyPlayer(players[at]);
}

/**
 * Build a setup from the names a person typed.
 *
 * createSetup({
 *   gameType: 6,
 *   gameMinutes: 120,
 *   rotations: 2,
 *   teams: [{ name: 'Bibs', players: ['Zoe', { name: 'Alex', late: true }] }, { ... }]
 * })
 *
 * A player is a string or `{ name, fixedGoalie, late }`. Call it again on every
 * keystroke while the setup screen is open. The ids come from the list
 * position, so the result is stable and pure.
 *
 * The order is kept exactly as it was given. It decides nothing: the ring is
 * drawn at `kickOff()`, and the two flags are applied there too. Nothing is
 * sorted here, so the setup screen shows the list the person typed.
 *
 * `intervalMs` is optional and is normally absent: a fresh setup derives its
 * interval live so the setup screen can preview it. Pass it to carry a frozen
 * interval forward — a setup rebuilt for an edit mid-game keeps the number the
 * kick-off wrote, so the countdown does not move under an edit either.
 */
export function createSetup(input = {}) {
  const gameType = clamp(Math.floor(num(input.gameType, DEFAULT_GAME_TYPE)), MIN_GAME_TYPE, MAX_GAME_TYPE);
  const gameMinutes = Math.max(0, Math.floor(num(input.gameMinutes, DEFAULT_GAME_MINUTES)));
  const rotations = rotationsOf(input);
  const frozen = frozenIntervalOf(input);
  const teamsIn = Array.isArray(input.teams) ? input.teams : [];

  const teams = teamsIn.map((team, teamIndex) => {
    const players = oneFixedGoalie(
      (Array.isArray(team.players) ? team.players : [])
        .map((entry) => (entry && typeof entry === 'object' ? entry : { name: entry }))
        .map((entry) => ({ ...entry, name: String(entry.name ?? '').trim() }))
        .filter((entry) => entry.name.length > 0)
        .map((entry, i) => ({
          id: `t${teamIndex}p${i}`,
          name: entry.name,
          fixedGoalie: entry.fixedGoalie === true,
          late: entry.late === true
        }))
    );

    return {
      name: String(team.name ?? DEFAULT_TEAM_NAMES[teamIndex] ?? `Team ${teamIndex + 1}`),
      players,
      anchor: null
    };
  });

  const setup = { gameType, gameMinutes, rotations, teams };
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

/**
 * The interval the clock actually runs on.
 *
 * The frozen number wins whenever it is there, which is from kick-off onwards.
 * Before then there is nothing stored and this derives live, so the setup
 * screen can show the number moving as names are typed.
 */
export function computeIntervalMs(setup) {
  return frozenIntervalOf(setup) ?? derivedIntervalMs(setup);
}

/** True once the interval is written down and a roster change cannot move it. */
export function isIntervalFrozen(setup) {
  return frozenIntervalOf(setup) !== null;
}

/**
 * The sum read backwards: how many rotations the live interval actually buys.
 *
 * One decimal place. This is what a frozen interval is worth after a squad has
 * changed size — an eighth player turns up and the 8:30 that meant twice each
 * is worth 1.8. Null when there is nobody to rotate.
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
 * Which ring slots may start in goal. Indexes into the drawn `team.players`.
 *
 * Everyone who starts on the pitch except the two ends of the line-up. The
 * first would come out of goal into the bench one change later; the last would
 * be replaced in goal by a sub. See the header for the arithmetic. This is the
 * list `kickOff()` draws from, and the list `test.js` checks the draw against.
 */
export function legalStartKeepers(setup, teamIndex) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return [];
  return legalStartsFor((team.players ?? []).length, gameTypeOf(setup));
}

function startAnchor(keeperIndex, n, g) {
  return { changeIndex: 0, keeperIndex, subIndex: mod(g, n) };
}

/**
 * The anchor a team starts on when nothing has been written down. The fixed
 * case counts its bench pointer in the ring without the goalie, so `g - 1`
 * there means the same as `g` does everywhere else: the head of the ring is on
 * the pitch and the tail is the bench.
 */
function startAnchorFor(n, g, fixedIndex) {
  if (fixedIndex >= 0) {
    return { changeIndex: 0, keeperIndex: fixedIndex, subIndex: mod(g - 1, Math.max(1, n - 1)) };
  }
  return startAnchor(legalStartsFor(n, g)[0] ?? 0, n, g);
}

/**
 * Kick off. Three things are settled here, once, and written down: the ring,
 * the starting keeper and the interval. Returns a new setup.
 *
 * The ring is a shuffle of the typed list with the flags applied on top — the
 * fixed goalie to the front, the late players to the back. The first `gameType`
 * names then start on the pitch and the rest are the bench, so the draw over
 * who starts is a draw over the whole squad. The keeper is drawn uniformly from
 * `legalStartKeepers()`, so the two hard rules hold from the first change.
 *
 * Idempotent both ways. A team that already has an anchor keeps its ring and
 * its keeper, and an interval already frozen is left alone. Both draws are the
 * only impure moment in the module and they happen once. After this call the
 * answers are in the setup and everything downstream is a pure function of
 * (setup, elapsedMs). Pass `random` to make it deterministic.
 */
export function kickOff(setup, random = Math.random) {
  const g = gameTypeOf(setup);
  const teams = ((setup && setup.teams) ?? []).map((team) => {
    if (team.anchor) return team;
    const players = oneFixedGoalie((team.players ?? []).map(copyPlayer));
    const n = players.length;
    if (n === 0) return { ...team, players, anchor: null };

    const ring = ringOrder(shuffle(players, random));
    const fixedIndex = fixedGoalieIndexOf(ring);
    if (fixedIndex >= 0) {
      return { ...team, players: ring, anchor: startAnchorFor(n, g, fixedIndex) };
    }

    const legal = legalStartsFor(n, g);
    const roll = clamp(num(random(), 0), 0, 0.999999);
    return { ...team, players: ring, anchor: startAnchor(legal[Math.floor(roll * legal.length)] ?? 0, n, g) };
  });
  return { ...setup, teams, intervalMs: computeIntervalMs(setup) };
}

/* ----------------------------------------------------------------- engine */

/**
 * Push an offset into the legal window. Every anchor this module writes for a
 * team with no fixed goalie goes through here, so the two rules hold by
 * construction and not by the caller's discipline.
 *
 * It is a no-op on all but one path. A legal start lands inside the window. A
 * removal drops N and C together, which leaves the window exactly where it was.
 * So does an arrival — unless the team has been under `gameType` and has just
 * climbed back over it, because a team with no bench has no window to sit in
 * and its offset drifts while it is short. The arrival that hands that team a
 * bench again pulls the offset back in. That bench is one seat wide and the
 * newcomer is the one sitting in it, so nobody else on the pitch notices.
 *
 * A team with a fixed goalie never comes here. Its window is the whole ring:
 * nobody crosses between goal and bench, so no offset can be illegal.
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
  const players = team.players ?? [];
  const n = players.length;
  if (n === 0) return null;

  const fixedIndex = fixedGoalieIndexOf(players);
  const modulus = fixedIndex >= 0 ? Math.max(1, n - 1) : n;
  const fallback = startAnchorFor(n, g, fixedIndex);
  const stored = team.anchor;

  if (stored && Number.isFinite(Number(stored.keeperIndex))) {
    return {
      changeIndex: Math.floor(num(stored.changeIndex, 0)),
      keeperIndex: fixedIndex >= 0 ? fixedIndex : mod(Math.floor(num(stored.keeperIndex, 0)), n),
      subIndex: mod(Math.floor(num(stored.subIndex, fallback.subIndex)), modulus)
    };
  }
  return fallback;
}

function slotsAt(team, changeIndex, g) {
  const order = (team.players ?? []).map(copyPlayer);
  const n = order.length;
  if (n === 0) {
    return {
      order, n, fixedIndex: -1, keeperIndex: -1,
      subIndexes: [], onPitchIndexes: [], benchRing: [], subPointer: 0, offset: 0
    };
  }

  const fixedIndex = fixedGoalieIndexOf(order);
  const c = subCountFor(n, g);
  const anchor = resolveAnchor(team, g);
  const step = changeIndex - anchor.changeIndex;

  let keeperIndex;
  let subPointer;
  let offset = 0;
  const benchRing = [];
  const subIndexes = [];

  if (fixedIndex >= 0) {
    keeperIndex = fixedIndex;
    for (let i = 0; i < n; i += 1) if (i !== fixedIndex) benchRing.push(i);
    const m = benchRing.length;
    subPointer = m > 0 ? mod(anchor.subIndex + step, m) : 0;
    for (let j = 0; j < Math.min(c, m); j += 1) subIndexes.push(benchRing[mod(subPointer + j, m)]);
  } else {
    keeperIndex = mod(anchor.keeperIndex + step, n);
    subPointer = mod(anchor.subIndex + step, n);
    for (let j = 0; j < c; j += 1) subIndexes.push(mod(subPointer + j, n));
    offset = mod(anchor.subIndex - anchor.keeperIndex, n);
  }

  const off = new Set(subIndexes);
  off.add(keeperIndex);
  const onPitchIndexes = [];
  for (let i = 0; i < n; i += 1) if (!off.has(i)) onPitchIndexes.push(i);

  return { order, n, fixedIndex, keeperIndex, subIndexes, onPitchIndexes, benchRing, subPointer, offset };
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

    hasFixedGoalie: now.fixedIndex >= 0,
    fixedGoalie: now.fixedIndex < 0 ? null : now.order[now.fixedIndex],
    fixedGoalieIndex: now.fixedIndex,

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
 *   intervalMs, changeIndex, msToNextChange, elapsedMs, gameMs, gameMinutes,
 *   gameType, rotations, frozen,
 *   teams: [{ name, order, subCount,
 *             hasFixedGoalie, fixedGoalie, fixedGoalieIndex,
 *             keeper, keeperIndex, subs, subIndexes, onPitch, onPitchIndexes,
 *             nextKeeper, nextKeeperIndex, nextSubs, nextSubIndexes,
 *             comingOn, goingOff }]
 * }
 *
 * Every player in there is `{ id, name, fixedGoalie, late }`, and `order` is
 * the whole squad in ring order — so a column that lists the squad reads
 * `nextKeeperIndex` and `nextSubIndexes` straight off and marks those rows.
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
    gameMinutes: gameMinutesOf(setup),
    gameType,
    rotations: rotationsOf(setup),
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

/** Re-anchor a team with no fixed goalie: pin the keeper, keep o, keep it legal. */
function reAnchor(setup, teamIndex, team, players, keeperIndex, changeIndex, offset) {
  const n = players.length;
  const o = safeOffset(n, subCountFor(n, gameTypeOf(setup)), offset);
  return replaceTeam(setup, teamIndex, {
    ...team,
    players: oneFixedGoalie(players),
    anchor: { changeIndex, keeperIndex, subIndex: mod(keeperIndex + o, n) }
  });
}

/** Re-anchor a team with a fixed goalie: only the bench pointer can move. */
function reAnchorFixed(setup, teamIndex, team, players, fixedIndex, changeIndex, subIndex) {
  return replaceTeam(setup, teamIndex, {
    ...team,
    players: oneFixedGoalie(players),
    anchor: { changeIndex, keeperIndex: fixedIndex, subIndex: mod(subIndex, Math.max(1, players.length - 1)) }
  });
}

/** The player the bench currently starts at, for a team with a fixed goalie. */
function benchStartIdOf(now) {
  if (now.benchRing.length === 0) return null;
  return now.order[now.benchRing[now.subPointer]].id;
}

/** Where that player sits in a new ring, or the old seat if they have gone. */
function benchPointerFor(players, fixedIndex, benchStartId, fallback) {
  const bench = players.filter((_, i) => i !== fixedIndex);
  if (bench.length === 0) return 0;
  const at = bench.findIndex((player) => player.id === benchStartId);
  return at >= 0 ? at : mod(fallback, bench.length);
}

/**
 * Someone turns up after kick-off. Returns a new setup.
 *
 * They join the front of the bench and come on at the next change. Nobody on
 * the pitch moves, the keeper does not change, and the clock does not move. A
 * team still short of `gameType` has no bench, so they walk straight on. They
 * are not flagged `late`: that flag is a place in the drawn ring, and this
 * person has a place already — the front of the bench.
 */
export function addLateArrival(setup, teamIndex, name, elapsedMs) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return setup;

  const trimmed = String(name).trim();
  if (trimmed.length === 0) return setup;

  const g = gameTypeOf(setup);
  const changeIndex = changeIndexAt(setup, elapsedMs);
  const now = slotsAt(team, changeIndex, g);
  const player = { id: nextLateId(team, teamIndex), name: trimmed, fixedGoalie: false, late: false };
  const players = (team.players ?? []).map(copyPlayer);

  if (now.n === 0) {
    players.push(player);
    return reAnchor(setup, teamIndex, team, players, 0, changeIndex, 0);
  }

  if (now.fixedIndex >= 0) {
    const m = now.benchRing.length;
    const at = m > 0 ? now.benchRing[now.subPointer] : players.length;
    players.splice(at, 0, player);
    const fixedIndex = now.fixedIndex < at ? now.fixedIndex : now.fixedIndex + 1;
    return reAnchorFixed(setup, teamIndex, team, players, fixedIndex, changeIndex, m > 0 ? now.subPointer : 0);
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
 *
 * A fixed goalie who goes home takes the fixed goalie with them: the team goes
 * back to the ordinary rota from that change, keeping the pitch exactly as it
 * stands and handing the shirt to the outfielder two slots before the bench,
 * which is the one choice that puts o on 2 and so cannot be illegal.
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

  if (now.fixedIndex >= 0) {
    const goalie = now.order[now.fixedIndex];
    const benchStartId = benchStartIdOf(now);

    if (goalie.id !== playerId) {
      const fixedIndex = players.findIndex((player) => player.id === goalie.id);
      const pointer = benchPointerFor(players, fixedIndex, benchStartId, now.subPointer);
      return reAnchorFixed(setup, teamIndex, team, players, fixedIndex, changeIndex, pointer);
    }

    const n = players.length;
    const at = benchStartId === null ? 0 : players.findIndex((player) => player.id === benchStartId);
    const benchStart = at < 0 ? 0 : at;
    return reAnchor(setup, teamIndex, team, players, mod(benchStart - 2, n), changeIndex, 2);
  }

  const keeper = now.order[now.keeperIndex];
  const successor = now.order[mod(now.keeperIndex + 1, now.n)];
  const holdOn = keeper.id === playerId ? successor : keeper;
  const keeperIndex = players.findIndex((player) => player.id === holdOn.id);

  return reAnchor(setup, teamIndex, team, players, keeperIndex, changeIndex, now.offset);
}

/**
 * Set or clear `late` on one player. Returns a new setup.
 *
 * The player goes to the back of the list and the ring is re-sorted, so
 * setting the flag makes them the last name of all and clearing it drops them
 * to the back of the players who are here. Everybody already flagged keeps the
 * order they had: the sort is stable and only this one player moved.
 *
 * The anchor is rewritten on the current change, so whoever is in goal right
 * now is still in goal right now. The bench can move, because a ring that has
 * been re-cut has to put the bench somewhere.
 *
 * A no-op call returns the setup it was given, untouched.
 */
export function setLate(setup, teamIndex, playerId, late, elapsedMs) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return setup;

  const players = (team.players ?? []).map(copyPlayer);
  const at = players.findIndex((player) => player.id === playerId);
  if (at < 0) return setup;

  const wanted = late !== false;
  if (players[at].late === wanted) return setup;
  const moved = { ...players[at], late: wanted };
  players.splice(at, 1);
  /* to the back of the list before the sort, so the newest flag is the last
     name of all and the players already flagged keep the order they had */
  players.push(moved);

  const g = gameTypeOf(setup);
  const changeIndex = changeIndexAt(setup, elapsedMs);
  const now = slotsAt(team, changeIndex, g);
  const ring = ringOrder(oneFixedGoalie(players));

  if (now.fixedIndex >= 0) {
    const fixedIndex = fixedGoalieIndexOf(ring);
    const pointer = benchPointerFor(ring, fixedIndex, benchStartIdOf(now), now.subPointer);
    return reAnchorFixed(setup, teamIndex, team, ring, fixedIndex, changeIndex, pointer);
  }

  const keeperId = now.order[now.keeperIndex].id;
  const keeperIndex = ring.findIndex((player) => player.id === keeperId);
  return reAnchor(setup, teamIndex, team, ring, keeperIndex, changeIndex, now.offset);
}

/**
 * Set or clear `fixedGoalie` on one player. Returns a new setup.
 *
 * Setting it makes that player the keeper from this change on and clears the
 * flag from anyone else on the team, so a team never holds two. The pitch is
 * re-cut around them exactly as a kick-off would cut it, because naming a
 * goalie is a decision about the whole rest of the game.
 *
 * Clearing it leaves that player in goal for the current change and hands the
 * team back to the ordinary two-pointer rota. The offset is clamped into the
 * legal window as it lands, which can move one outfielder onto the bench.
 *
 * A no-op call returns the setup it was given, untouched.
 */
export function setFixedGoalie(setup, teamIndex, playerId, fixed, elapsedMs) {
  const team = ((setup && setup.teams) ?? [])[teamIndex];
  if (!team) return setup;

  const players = (team.players ?? []).map(copyPlayer);
  const at = players.findIndex((player) => player.id === playerId);
  if (at < 0) return setup;

  const wanted = fixed !== false;
  const g = gameTypeOf(setup);
  const changeIndex = changeIndexAt(setup, elapsedMs);
  const now = slotsAt(team, changeIndex, g);

  if (wanted) {
    if (now.fixedIndex === at) return setup;
    const ring = ringOrder(players.map((player, i) => ({ ...player, fixedGoalie: i === at })));
    const n = ring.length;
    return reAnchorFixed(
      setup, teamIndex, team, ring,
      fixedGoalieIndexOf(ring), changeIndex, mod(g - 1, Math.max(1, n - 1))
    );
  }

  if (now.fixedIndex !== at) return setup;
  const ring = ringOrder(players.map((player, i) => (i === at ? { ...player, fixedGoalie: false } : player)));
  const keeperIndex = ring.findIndex((player) => player.id === playerId);
  const benchStartId = benchStartIdOf(now);
  const benchStart = benchStartId === null ? keeperIndex : ring.findIndex((player) => player.id === benchStartId);
  const offset = mod((benchStart < 0 ? keeperIndex : benchStart) - keeperIndex, ring.length);
  return reAnchor(setup, teamIndex, team, ring, keeperIndex, changeIndex, offset);
}
