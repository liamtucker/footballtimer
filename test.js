/*
 * test.js — plain assertions for rotation.js. Run: node test.js
 * Exits non-zero on any failure.
 */

import {
  rotation,
  createSetup,
  computeIntervalMs,
  changeIndexAt,
  subCountFor,
  legalStartKeepers,
  isLegalStartKeeper,
  nearestLegalStartKeeper,
  setStartKeeper,
  kickOff,
  addLateArrival,
  removePlayer,
  rotationsOf,
  squadSizeOf,
  derivedIntervalMs,
  isIntervalFrozen,
  rotationsPerPlayer,
  MS_PER_MINUTE,
  MIN_GAME_TYPE,
  MAX_GAME_TYPE,
  DEFAULT_GAME_TYPE,
  DEFAULT_GAME_MINUTES,
  DEFAULT_ROTATIONS,
  MIN_ROTATIONS,
  MAX_ROTATIONS,
  INTERVAL_GRAIN_MS,
  MIN_INTERVAL_MS
} from './rotation.js';

/* ---------------------------------------------------------------- harness */

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name}\n       ${error.message}`);
    console.log(`  FAIL ${name}`);
    console.log(`       ${error.message}`);
  }
}

function ok(value, message) {
  if (!value) throw new Error(message || 'expected true');
}

function eq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'not equal'} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || 'not the same'}\n       expected ${b}\n       got      ${a}`);
}

/* ------------------------------------------------------------- test data */

const NAMES = [
  'Zoe', 'Alex', 'Sam', 'Ben', 'Cara', 'Dan', 'Eve', 'Finn', 'Gus', 'Hal',
  'Iris', 'Jo', 'Kai', 'Lena', 'Mo', 'Nia', 'Otto', 'Pia', 'Rey', 'Sky'
];

/** Names in the order a person dragged them. Deliberately not alphabetical. */
function squad(size) {
  return NAMES.slice(0, size);
}

function setupOf(sizeA, sizeB, options = {}) {
  return createSetup({
    gameType: options.gameType ?? 6,
    gameMinutes: options.gameMinutes ?? 120,
    rotations: options.rotations ?? DEFAULT_ROTATIONS,
    intervalMs: options.intervalMs,
    teams: [
      { name: 'Bibs', players: options.playersA ?? squad(sizeA) },
      { name: 'No bibs', players: options.playersB ?? squad(sizeB) }
    ]
  });
}

/** The interval as the screen writes it. 510000 has to read 8:30. */
function clockText(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Keeper spells per player, counted over the changes inside the game time. */
function spellsInsideTheGame(setup, teamIndex) {
  const intervalMs = computeIntervalMs(setup);
  const changes = Math.floor((setup.gameMinutes * MS_PER_MINUTE) / intervalMs);
  const tally = new Map();
  for (const player of setup.teams[teamIndex].players) tally.set(player.id, 0);
  for (let k = 0; k < changes; k += 1) {
    const keeper = stateAt(setup, teamIndex, k).keeper;
    tally.set(keeper.id, tally.get(keeper.id) + 1);
  }
  return [...tally.values()];
}

function stateAt(setup, teamIndex, changeIndex) {
  return rotation(setup, changeIndex * computeIntervalMs(setup)).teams[teamIndex];
}

function ids(players) {
  return players.map((player) => player.id);
}

/** Force an anchor the module would never write. Used to test the boundary. */
function withRawStart(setup, teamIndex, keeperIndex) {
  const teams = setup.teams.map((team, i) => {
    if (i !== teamIndex) return team;
    const n = team.players.length;
    return { ...team, anchor: { changeIndex: 0, keeperIndex, subIndex: setup.gameType % n } };
  });
  return { ...setup, teams };
}

/** A repeatable stand-in for Math.random. Spread matters — the draw is tested. */
function dice(seed) {
  let s = ((seed + 1) * 2654435761) >>> 0;
  return () => {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return s / 4294967296;
  };
}

/** A draw that always rolls the same number. */
function roll(value) {
  return () => value;
}

/** The two hard rules, plus the roles adding up, over a run of changes. */
function checkRules(setup, teamIndex, changes, label) {
  for (let k = 0; k <= changes; k += 1) {
    const team = stateAt(setup, teamIndex, k);
    const here = `${label} change ${k}`;
    if (!team.keeper) continue;

    const subs = new Set(ids(team.subs));
    const next = new Set(ids(team.nextSubs));

    ok(!subs.has(team.keeper.id), `${here}: the keeper is also a sub`);
    ok(!next.has(team.keeper.id), `${here}: ${team.keeper.name} comes out of goal and sits down`);
    ok(!subs.has(team.nextKeeper.id), `${here}: ${team.nextKeeper.name} goes from the bench into goal`);

    eq(subs.size, team.subs.length, `${here}: the subs are not distinct`);
    eq(
      team.subs.length + team.onPitch.length + 1,
      team.order.length,
      `${here}: the roles do not add up`
    );
    const seen = new Set([team.keeper.id, ...ids(team.subs), ...ids(team.onPitch)]);
    eq(seen.size, team.order.length, `${here}: a player holds two roles at once`);
  }
}

/* ------------------------------------------------------------ the setup */

console.log('\nthe setup');

test('the list order is kept exactly — nothing is sorted', () => {
  const names = ['Zoe', 'Alex', 'Sam', 'Ben', 'Cara', 'Dan'];
  const setup = setupOf(6, 6, { playersA: names });
  same(setup.teams[0].players.map((player) => player.name), names);
});

test('the defaults are 6 a side, 2 hours, twice each', () => {
  const setup = createSetup({ teams: [{ players: squad(6) }] });
  eq(setup.gameType, DEFAULT_GAME_TYPE);
  eq(setup.gameMinutes, DEFAULT_GAME_MINUTES);
  eq(setup.rotations, DEFAULT_ROTATIONS);
});

test('gameType clamps to 4 .. 11', () => {
  eq(createSetup({ gameType: 1, teams: [] }).gameType, MIN_GAME_TYPE);
  eq(createSetup({ gameType: 99, teams: [] }).gameType, MAX_GAME_TYPE);
  eq(createSetup({ gameType: 5, teams: [] }).gameType, 5);
});

test('blank names drop out and ids are stable', () => {
  const setup = setupOf(0, 0, { playersA: ['Zoe', '  ', 'Sam', ''] });
  eq(setup.teams[0].players.length, 2);
  same(ids(setup.teams[0].players), ['t0p0', 't0p1']);
  same(setupOf(0, 0, { playersA: ['Zoe', 'Sam'] }), setupOf(0, 0, { playersA: ['Zoe', 'Sam'] }));
});

test('a fresh setup has no starting keeper until kick-off', () => {
  eq(setupOf(8, 8).teams[0].anchor, null);
});

/* ---------------------------------------------------------- the interval */

console.log('\nthe interval');

test("Liam's case — 2 hours, 7 v 6, twice each — reads 8:30", () => {
  const setup = setupOf(7, 6, { gameMinutes: 120, rotations: 2 });
  eq(computeIntervalMs(setup), 510000, '8 minutes 30');
  eq(clockText(computeIntervalMs(setup)), '8:30');
  eq(rotation(setup, 0).intervalMs, 510000);
});

test('the derived interval is the game time cut N times rotations ways', () => {
  eq(computeIntervalMs(setupOf(6, 6, { gameMinutes: 90, rotations: 3 })), 5 * MS_PER_MINUTE);
  eq(computeIntervalMs(setupOf(8, 8, { gameMinutes: 120, rotations: 2 })), 450000);
  eq(computeIntervalMs(setupOf(10, 10, { gameMinutes: 60, rotations: 1 })), 6 * MS_PER_MINUTE);
});

test('the interval floors to fifteen seconds and never rounds up', () => {
  for (let n = 4; n <= 16; n += 1) {
    for (let r = MIN_ROTATIONS; r <= MAX_ROTATIONS; r += 1) {
      for (const minutes of [30, 45, 75, 90, 105, 120, 180]) {
        const setup = setupOf(n, n, { gameMinutes: minutes, rotations: r });
        const got = computeIntervalMs(setup);
        const raw = (minutes * MS_PER_MINUTE) / (n * r);
        const where = `${minutes} min, ${n} players, ${r} rotations`;
        eq(got % INTERVAL_GRAIN_MS, 0, `${where}: off the 15-second grid`);
        ok(got >= MIN_INTERVAL_MS, `${where}: under the minimum`);
        if (got === MIN_INTERVAL_MS) continue;
        ok(got <= raw, `${where}: rounded up past the game time`);
        ok(raw - got < INTERVAL_GRAIN_MS, `${where}: floored more than one step`);
      }
    }
  }
});

test('the interval never falls below a minute', () => {
  /* 30 minutes, 11 players, 5 rotations is 32.7 seconds — a scramble, not a shift */
  eq(computeIntervalMs(setupOf(11, 11, { gameMinutes: 30, rotations: 5 })), MIN_INTERVAL_MS);
  eq(computeIntervalMs(setupOf(8, 8, { gameMinutes: 0, rotations: 2 })), MIN_INTERVAL_MS);
});

test('N is the larger squad, not the smaller', () => {
  const uneven = setupOf(9, 5, { gameMinutes: 120, rotations: 2 });
  eq(squadSizeOf(uneven), 9);
  eq(computeIntervalMs(uneven), computeIntervalMs(setupOf(9, 9, { gameMinutes: 120, rotations: 2 })));
  ok(
    computeIntervalMs(uneven) !== computeIntervalMs(setupOf(5, 5, { gameMinutes: 120, rotations: 2 })),
    'the smaller squad must not set the interval'
  );
  eq(squadSizeOf(setupOf(5, 9)), 9, 'either side of the setup');
});

test('uneven teams: the larger squad gets its rotations and the smaller gets more', () => {
  const setup = kickOff(setupOf(8, 6, { gameMinutes: 120, rotations: 2 }), dice(51));
  eq(computeIntervalMs(setup), 450000, '7 minutes 30');
  const big = spellsInsideTheGame(setup, 0);
  const small = spellsInsideTheGame(setup, 1);
  eq(Math.min(...big), 2, 'the eight get exactly the two they were promised');
  eq(Math.max(...big), 2);
  ok(Math.min(...small) >= 2, 'the six are never short');
  ok(Math.max(...small) > 2, 'and some of the six get a third');
});

test('there is no manual override — an old setup is read and ignored', () => {
  /* a squad saved by the build that had the swap may carry both of these */
  const old = setupOf(7, 6, { gameMinutes: 120, rotations: 2 });
  const carried = { ...old, intervalMode: 'manual', subMinutes: 4 };
  eq(computeIntervalMs(carried), 510000, 'it behaves as rotations');
  eq(rotation(carried, 0).intervalMs, 510000, 'and nothing throws');
  eq(rotation(carried, 0).intervalMode, undefined, 'the mode is gone from the result');
  eq(createSetup({ intervalMode: 'manual', subMinutes: 4, teams: [] }).intervalMode, undefined,
    'and createSetup never writes it back');
  eq(createSetup({ subMinutes: 4, teams: [] }).subMinutes, undefined);
});

test('a game already running keeps the interval it froze, whatever wrote it', () => {
  /* the one path that matters: a phone restored mid-game under the new build */
  const running = { ...setupOf(7, 6, { gameMinutes: 120, rotations: 2, intervalMs: 600000 }),
    intervalMode: 'manual', subMinutes: 10 };
  eq(computeIntervalMs(running), 600000, 'the pace does not change under the person holding it');
  ok(isIntervalFrozen(running));
  eq(rotationsPerPlayer(running), 1.7, 'and the readout says what it is really worth');
});

test('the interval is the same whatever an old subMinutes said', () => {
  const a = { ...setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), subMinutes: 3 };
  const b = { ...setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), subMinutes: 20 };
  eq(computeIntervalMs(a), 510000);
  eq(computeIntervalMs(b), 510000);
});

test('gameMinutes still changes nothing but gameMs, once the interval is frozen', () => {
  const short = setupOf(8, 7, { gameMinutes: 45, intervalMs: 600000 });
  const long = setupOf(8, 7, { gameMinutes: 120, intervalMs: 600000 });
  for (const ms of [0, 600000, 5400000, 12345678]) {
    same(rotation(short, ms).teams, rotation(long, ms).teams, `elapsed ${ms}`);
    eq(rotation(short, ms).intervalMs, rotation(long, ms).intervalMs);
  }
  eq(rotation(short, 0).gameMs, 45 * MS_PER_MINUTE);
  eq(rotation(long, 0).gameMs, 120 * MS_PER_MINUTE);
});

test('rotations is a whole number, clamped to 1 .. 5', () => {
  eq(rotationsOf({}), DEFAULT_ROTATIONS, 'two by default');
  eq(rotationsOf({ rotations: 0 }), MIN_ROTATIONS);
  eq(rotationsOf({ rotations: 99 }), MAX_ROTATIONS);
  eq(rotationsOf({ rotations: 2.9 }), 2);
  eq(rotationsOf({ rotations: 'four' }), DEFAULT_ROTATIONS);
  eq(setupOf(8, 6, { rotations: 9 }).rotations, MAX_ROTATIONS, 'createSetup clamps it too');
});

/* ------------------------------------------------------ the reverse readout */

console.log('\nthe reverse readout');

test('the reverse readout says what a frozen interval is really worth', () => {
  eq(rotationsPerPlayer(setupOf(7, 6, { gameMinutes: 120, intervalMs: 600000 })), 1.7,
    'ten minutes over seven players is 1.7 rotations each, not 2');
  eq(rotationsPerPlayer(setupOf(7, 6, { gameMinutes: 120, intervalMs: 480000 })), 2.1);
  eq(rotationsPerPlayer(setupOf(6, 6, { gameMinutes: 90, intervalMs: 300000 })), 3);
});

test('the reverse readout agrees with the derivation it came from', () => {
  for (let n = 4; n <= 14; n += 1) {
    for (let r = MIN_ROTATIONS; r <= MAX_ROTATIONS; r += 1) {
      const setup = setupOf(n, n, { gameMinutes: 120, rotations: r });
      if (computeIntervalMs(setup) === MIN_INTERVAL_MS) continue;
      const got = computeIntervalMs(setup);
      const back = rotationsPerPlayer(setup);
      ok(back >= r, `${n} players, ${r} rotations: the readout came up short at ${back}`);
      /* and the floor took the largest step that still delivers the promise */
      const longer = (120 * MS_PER_MINUTE) / (n * (got + INTERVAL_GRAIN_MS));
      ok(longer < r, `${n} players, ${r} rotations: 15 seconds were left on the table`);
    }
  }
});

test('the reverse readout is one decimal place, and null with nobody to rotate', () => {
  const value = rotationsPerPlayer(setupOf(7, 6, { gameMinutes: 120, intervalMs: 600000 }));
  eq(Math.round(value * 10) / 10, value, 'more than one decimal place');
  eq(rotationsPerPlayer(createSetup({})), null, 'no squads');
  eq(rotationsPerPlayer(createSetup({ teams: [{ name: 'Bibs', players: [] }] })), null, 'empty squads');
});

/* ---------------------------------------------------- the interval freezes */

console.log('\nthe interval freezes at kick-off');

test('before kick-off the interval derives live, so the setup screen can preview it', () => {
  ok(!isIntervalFrozen(setupOf(7, 6, { gameMinutes: 120, rotations: 2 })));
  eq(computeIntervalMs(setupOf(7, 6, { gameMinutes: 120, rotations: 2 })), 510000);
  eq(computeIntervalMs(setupOf(8, 6, { gameMinutes: 120, rotations: 2 })), 450000, 'a name typed moves it');
});

test('kickOff resolves the interval and writes it onto the setup', () => {
  const setup = kickOff(setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), dice(52));
  ok(isIntervalFrozen(setup));
  eq(setup.intervalMs, 510000);
  eq(rotation(setup, 0).intervalMs, 510000);
  eq(rotation(setup, 0).frozen, true);
});

test('a late arrival changes N and the interval does not move', () => {
  const setup = kickOff(setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), dice(54));
  const at = 20 * MS_PER_MINUTE;
  const grown = addLateArrival(setup, 0, 'Wren', at);
  eq(grown.teams[0].players.length, 8, 'N really did move');
  eq(squadSizeOf(grown), 8);
  eq(computeIntervalMs(grown), 510000, 'the countdown must never jump');
  eq(derivedIntervalMs(grown), 450000, 'and the live derivation really would have jumped');
});

test('the countdown does not move when a late arrival lands mid-shift', () => {
  const setup = kickOff(setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), dice(55));
  const at = 12 * MS_PER_MINUTE;
  const before = rotation(setup, at);
  const after = rotation(addLateArrival(setup, 0, 'Wren', at), at);
  eq(after.intervalMs, before.intervalMs);
  eq(after.changeIndex, before.changeIndex);
  eq(after.msToNextChange, before.msToNextChange);
});

test('a removal does not move a frozen interval either', () => {
  const setup = kickOff(setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), dice(56));
  const at = 20 * MS_PER_MINUTE;
  const smaller = removePlayer(setup, 0, setup.teams[0].players[3].id, at);
  eq(smaller.teams[0].players.length, 6);
  eq(computeIntervalMs(smaller), 510000);
  eq(rotation(smaller, at).msToNextChange, rotation(setup, at).msToNextChange);
});

test('the price of the freeze — twice each becomes a little less than twice', () => {
  const setup = kickOff(setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), dice(57));
  eq(rotationsPerPlayer(setup), 2);
  eq(rotationsPerPlayer(addLateArrival(setup, 0, 'Wren', 0)), 1.8, 'a squad that grew is short of two');
});

test('kickOff leaves a frozen interval alone, and is idempotent', () => {
  const once = kickOff(setupOf(7, 6, { gameMinutes: 120, rotations: 2 }), dice(58));
  same(kickOff(once, dice(59)), once, 'a second kick-off changes nothing');
  const grown = addLateArrival(once, 0, 'Wren', 0);
  eq(kickOff(grown, dice(60)).intervalMs, 510000, 'and it never re-derives over a stored number');
});

test('createSetup carries a frozen interval when it is handed one', () => {
  const carried = setupOf(8, 6, { gameMinutes: 120, rotations: 2, intervalMs: 510000 });
  ok(isIntervalFrozen(carried));
  eq(computeIntervalMs(carried), 510000, 'the edit route keeps the kick-off number');
  ok(!isIntervalFrozen(setupOf(8, 6)), 'and a fresh setup carries none');
  eq(setupOf(8, 6).intervalMs, undefined);
});

/* ------------------------------------------------------------- kick-off */

console.log('\nthe kick-off line-up');

test('subCount is squad minus gameType, floor 0', () => {
  eq(subCountFor(6, 6), 0);
  eq(subCountFor(9, 6), 3);
  eq(subCountFor(4, 6), 0, 'a short squad plays short');
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = 1; n <= 16; n += 1) {
      eq(rotation(setupOf(n, n, { gameType: g }), 0).teams[0].subCount, Math.max(0, n - g), `${g} a side, squad ${n}`);
    }
  }
});

test('at change 0 the subs are exactly the players below the dividing line', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = g; n <= g + 5; n += 1) {
      const setup = kickOff(setupOf(n, n, { gameType: g }), dice(n * 31 + g));
      const team = stateAt(setup, 0, 0);
      same(team.subIndexes, [...Array(n - g).keys()].map((j) => g + j), `${g} a side, squad ${n}`);
      same(
        team.subs.map((player) => player.name),
        squad(n).slice(g),
        `${g} a side, squad ${n}`
      );
    }
  }
});

test('at change 0 the keeper and the pitch are exactly the players above the line', () => {
  const setup = kickOff(setupOf(9, 9, { gameType: 6 }), dice(7));
  const team = stateAt(setup, 0, 0);
  const above = [team.keeperIndex, ...team.onPitchIndexes].sort((a, b) => a - b);
  same(above, [0, 1, 2, 3, 4, 5]);
});

test('a squad shorter than gameType plays short and nothing is wrong', () => {
  const setup = kickOff(setupOf(4, 6, { gameType: 6 }), dice(3));
  const team = stateAt(setup, 0, 0);
  eq(team.subCount, 0);
  eq(team.subs.length, 0);
  eq(team.onPitch.length, 3);
  ok(team.keeper !== null);
  checkRules(setup, 0, 12, 'short squad');
});

/* ------------------------------------------------------ the start keeper */

console.log('\nthe starting keeper');

test('the legal starts are 1 .. gameType - 2', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = g; n <= g + 5; n += 1) {
      const wanted = [];
      for (let i = 1; i <= g - 2; i += 1) wanted.push(i);
      same(legalStartKeepers(setupOf(n, n, { gameType: g }), 0), wanted, `${g} a side, squad ${n}`);
    }
  }
});

test('the two ends of the line-up and every sub are refused', () => {
  const setup = setupOf(9, 9, { gameType: 6 });
  eq(isLegalStartKeeper(setup, 0, 0), false, 'the first name');
  eq(isLegalStartKeeper(setup, 0, 5), false, 'the last name above the line');
  eq(isLegalStartKeeper(setup, 0, 6), false, 'a sub');
  eq(isLegalStartKeeper(setup, 0, 8), false, 'the last sub');
  for (let i = 1; i <= 4; i += 1) eq(isLegalStartKeeper(setup, 0, i), true, `index ${i}`);
});

test('an illegal tap has a nearest legal name', () => {
  const setup = setupOf(9, 9, { gameType: 6 });
  eq(nearestLegalStartKeeper(setup, 0, 0), 1);
  eq(nearestLegalStartKeeper(setup, 0, 5), 4);
  eq(nearestLegalStartKeeper(setup, 0, 8), 4);
  eq(nearestLegalStartKeeper(setup, 0, 3), 3, 'a legal tap does not move');
});

test('setStartKeeper stores the tap, and moves an illegal one', () => {
  const setup = setupOf(9, 9, { gameType: 6 });
  eq(stateAt(setStartKeeper(setup, 0, 3), 0, 0).keeperIndex, 3);
  eq(stateAt(setStartKeeper(setup, 0, 0), 0, 0).keeperIndex, 1);
  eq(stateAt(setStartKeeper(setup, 0, 7), 0, 0).keeperIndex, 4);
  same(setStartKeeper(setup, 0, 3).teams[1], setup.teams[1], 'the other team is untouched');
});

test('kickOff draws from the legal starts only, and covers all of them', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    const setup = setupOf(g + 2, g + 2, { gameType: g });
    const legal = legalStartKeepers(setup, 0);
    const drawn = new Set();
    for (let step = 0; step < 1000; step += 1) {
      const draw = step < 500 ? roll(step / 500) : dice(step);
      const index = kickOff(setup, draw).teams[0].anchor.keeperIndex;
      ok(legal.includes(index), `${g} a side drew an illegal start ${index}`);
      drawn.add(index);
    }
    eq(drawn.size, legal.length, `${g} a side never drew some of ${JSON.stringify(legal)}`);
  }
});

test('the draw is written down, so the same setup always gives the same answer', () => {
  const kicked = kickOff(setupOf(8, 8), dice(11));
  ok(kicked.teams[0].anchor !== null);
  const restored = JSON.parse(JSON.stringify(kicked));
  for (const ms of [0, 600000, 5400000]) same(rotation(restored, ms), rotation(kicked, ms), `elapsed ${ms}`);
});

test('kickOff is idempotent and never overrides a tap', () => {
  const tapped = setStartKeeper(setupOf(8, 8), 0, 2);
  const kicked = kickOff(tapped, dice(5));
  eq(kicked.teams[0].anchor.keeperIndex, 2, 'the tap survives');
  same(kickOff(kicked, dice(9)), kicked, 'a second kick-off changes nothing');
});

test('the two teams draw separately', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed += 1) {
    const kicked = kickOff(setupOf(8, 8), dice(seed));
    seen.add(`${kicked.teams[0].anchor.keeperIndex}-${kicked.teams[1].anchor.keeperIndex}`);
  }
  ok(seen.size > 4, 'the two teams always drew the same pair');
});

test('a preview before kick-off is legal and deterministic', () => {
  const setup = setupOf(9, 9);
  eq(stateAt(setup, 0, 0).keeperIndex, 1);
  checkRules(setup, 0, 27, 'no anchor yet');
});

/* --------------------------------------------------------- the two rules */

console.log('\nthe two hard rules');

test('no player goes goal to bench or bench to goal — every game type, squad and legal start', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = g; n <= g + 5; n += 1) {
      const base = setupOf(n, n, { gameType: g });
      for (const start of legalStartKeepers(base, 0)) {
        checkRules(setStartKeeper(base, 0, start), 0, 3 * n, `${g} a side, squad ${n}, start ${start}`);
      }
    }
  }
});

test('starting at index 0 breaks the first rule, exactly as the arithmetic says', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = g + 1; n <= g + 3; n += 1) {
      const setup = withRawStart(setupOf(n, n, { gameType: g }), 0, 0);
      for (let k = 0; k < 3; k += 1) {
        const team = stateAt(setup, 0, k);
        ok(
          ids(team.nextSubs).includes(team.keeper.id),
          `${g} a side, squad ${n}: index 0 was expected to send the keeper to the bench`
        );
        ok(!ids(team.subs).includes(team.nextKeeper.id), 'and to leave the second rule alone');
      }
    }
  }
});

test('starting at index gameType - 1 breaks the second rule, and only that one', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = g + 1; n <= g + 3; n += 1) {
      const setup = withRawStart(setupOf(n, n, { gameType: g }), 0, g - 1);
      for (let k = 0; k < 3; k += 1) {
        const team = stateAt(setup, 0, k);
        ok(
          ids(team.subs).includes(team.nextKeeper.id),
          `${g} a side, squad ${n}: index ${g - 1} was expected to put a sub into goal`
        );
        ok(!ids(team.nextSubs).includes(team.keeper.id), 'and to leave the first rule alone');
      }
    }
  }
});

test('starting a sub in goal makes them keeper and sub at once', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    const n = g + 3;
    for (let start = g; start < n; start += 1) {
      const team = stateAt(withRawStart(setupOf(n, n, { gameType: g }), 0, start), 0, 0);
      ok(ids(team.subs).includes(team.keeper.id), `${g} a side, start ${start}`);
    }
  }
});

test('every anchor the module writes is legal, however the roster moves', () => {
  const random = dice(2024);
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    let setup = kickOff(setupOf(g, g + 4, { gameType: g }), dice(g));
    let elapsed = 0;
    for (let round = 0; round < 12; round += 1) {
      elapsed += computeIntervalMs(setup) * (1 + round) + 1234;
      const team = setup.teams[0];
      if (random() < 0.5 || team.players.length < 3) {
        setup = addLateArrival(setup, 0, NAMES[round % NAMES.length] + round, elapsed);
      } else {
        const victim = team.players[Math.floor(random() * team.players.length)];
        setup = removePlayer(setup, 0, victim.id, elapsed);
      }
      checkRules(setup, 0, 3 * setup.teams[0].players.length, `${g} a side after round ${round}`);
    }
  }
});

/* ------------------------------------------------------------ the lap */

console.log('\nthe lap');

test('over one lap every player keeps goal once and sits exactly subCount times', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = g; n <= g + 5; n += 1) {
      const setup = kickOff(setupOf(n, n, { gameType: g }), dice(n + g));
      const goal = new Map();
      const bench = new Map();
      for (const player of setup.teams[0].players) {
        goal.set(player.id, 0);
        bench.set(player.id, 0);
      }
      for (let k = 0; k < n; k += 1) {
        const team = stateAt(setup, 0, k);
        goal.set(team.keeper.id, goal.get(team.keeper.id) + 1);
        for (const sub of team.subs) bench.set(sub.id, bench.get(sub.id) + 1);
      }
      for (const count of goal.values()) eq(count, 1, `${g} a side, squad ${n}: goal shifts in a lap`);
      for (const count of bench.values()) eq(count, n - g, `${g} a side, squad ${n}: bench shifts in a lap`);
    }
  }
});

test('the rota repeats exactly one lap later, forever', () => {
  const setup = kickOff(setupOf(7, 7), dice(4));
  for (let k = 0; k < 40; k += 1) {
    same(stateAt(setup, 0, k).keeper, stateAt(setup, 0, k + 7).keeper, `change ${k}`);
    same(stateAt(setup, 0, k).subs, stateAt(setup, 0, k + 7).subs, `change ${k} subs`);
  }
});

test('the rotation runs on past gameMinutes and never stops', () => {
  const setup = kickOff(setupOf(8, 7, { gameMinutes: 45 }), dice(6));
  eq(computeIntervalMs(setup), 165000, '45 minutes, 8 players, twice each');
  const state = rotation(setup, 6 * 3600000); // six hours
  eq(state.changeIndex, 130);
  ok(state.elapsedMs > state.gameMs, 'well past the reference duration');
  ok(state.teams[0].keeper !== null);
  eq(state.teams[0].subs.length, 2);
  eq(state.teams[1].subs.length, 1);
});

test('nextKeeper and nextSubs are the following change, read now', () => {
  const setup = kickOff(setupOf(9, 7), dice(8));
  for (let k = 0; k < 20; k += 1) {
    for (let t = 0; t < 2; t += 1) {
      same(stateAt(setup, t, k).nextKeeper, stateAt(setup, t, k + 1).keeper, `team ${t}, change ${k}`);
      same(stateAt(setup, t, k).nextSubs, stateAt(setup, t, k + 1).subs, `team ${t} subs, change ${k}`);
    }
  }
});

/* ---------------------------------------------------- what the display gets */

console.log('\nwhat the display gets');

test('onPitch is everyone who is neither keeper nor sub', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    for (let n = Math.max(1, g - 2); n <= g + 4; n += 1) {
      const setup = kickOff(setupOf(n, n, { gameType: g }), dice(n * g));
      const team = stateAt(setup, 0, 5);
      eq(team.onPitch.length, n - 1 - Math.max(0, n - g), `${g} a side, squad ${n}`);
      eq(team.onPitch.length + 1, Math.min(n, g), 'the pitch holds gameType, or the whole squad');
      same(ids(team.onPitch), team.onPitchIndexes.map((i) => team.order[i].id));
    }
  }
});

test('comingOn and goingOff are one name each, and the arrows point the right way', () => {
  for (let n = 7; n <= 12; n += 1) {
    const setup = kickOff(setupOf(n, n), dice(n));
    for (let k = 0; k < 2 * n; k += 1) {
      const team = stateAt(setup, 0, k);
      const label = `squad ${n}, change ${k}`;
      eq(team.comingOn.length, 1, label);
      eq(team.goingOff.length, 1, label);
      same(team.comingOn[0], team.subs[0], `${label}: comingOn is the front of the bench`);
      same(team.goingOff[0], team.nextSubs[team.nextSubs.length - 1], `${label}: goingOff is the back of the next bench`);
      ok(ids(team.onPitch).includes(team.goingOff[0].id), `${label}: the player going off was on the pitch`);
      ok(!ids(team.nextSubs).includes(team.comingOn[0].id), `${label}: the player coming on is still a sub`);
      ok(team.goingOff[0].id !== team.keeper.id, `${label}: the keeper is not going off`);
      ok(team.comingOn[0].id !== team.nextKeeper.id, `${label}: nobody comes on straight into goal`);
    }
  }
});

test('a team with no bench has no arrows', () => {
  const team = stateAt(kickOff(setupOf(6, 6), dice(2)), 0, 3);
  eq(team.subs.length, 0);
  eq(team.nextSubs.length, 0);
  eq(team.comingOn.length, 0);
  eq(team.goingOff.length, 0);
  ok(team.keeper.id !== team.nextKeeper.id, 'the goal still changes hands');
});

test('the keeper handover is not an arrow — the keeper stays on the pitch', () => {
  const setup = kickOff(setupOf(9, 9), dice(12));
  for (let k = 0; k < 18; k += 1) {
    const team = stateAt(setup, 0, k);
    const next = stateAt(setup, 0, k + 1);
    ok(ids(next.onPitch).includes(team.keeper.id), `change ${k}: the old keeper left the pitch`);
    ok(ids(team.onPitch).includes(next.keeper.id), `change ${k}: the new keeper came from the bench`);
  }
});

test('two teams of different sizes both work off one clock', () => {
  const setup = kickOff(setupOf(9, 6), dice(1));
  const state = rotation(setup, 4 * computeIntervalMs(setup) + 10);
  eq(state.teams[0].order.length, 9);
  eq(state.teams[1].order.length, 6);
  eq(state.teams[0].subs.length, 3);
  eq(state.teams[1].subs.length, 0);
  eq(state.changeIndex, 4, 'one clock, both teams change together');
});

/* ------------------------------------------------------------- the clock */

console.log('\nthe clock');

test('elapsed 0 is change 0 with a full interval to run', () => {
  const state = rotation(setupOf(8, 6), 0);
  eq(state.changeIndex, 0);
  eq(state.msToNextChange, state.intervalMs);
  eq(state.elapsedMs, 0);
});

test('msToNextChange counts down and resets on the crossing', () => {
  const setup = setupOf(8, 6);
  const interval = computeIntervalMs(setup);
  eq(rotation(setup, 1000).msToNextChange, interval - 1000);
  eq(rotation(setup, interval - 1).msToNextChange, 1);
  eq(rotation(setup, interval).msToNextChange, interval, 'a full interval again on the boundary');
  eq(rotation(setup, interval).changeIndex, 1);
  eq(rotation(setup, interval - 1).changeIndex, 0);
});

test('msToNextChange always sits in (0, intervalMs]', () => {
  const setup = setupOf(7, 6);
  const interval = computeIntervalMs(setup);
  for (let ms = 0; ms < interval * 3; ms += 7919) {
    const state = rotation(setup, ms);
    ok(state.msToNextChange > 0 && state.msToNextChange <= interval, `elapsed ${ms}`);
  }
});

test('elapsed before kick-off clamps to change 0', () => {
  const setup = setupOf(7, 6);
  same(rotation(setup, -5000), rotation(setup, 0));
});

test('changeIndexAt agrees with rotation', () => {
  const setup = setupOf(9, 7);
  for (const ms of [0, 1, 100000, 5400000, 9999999]) {
    eq(changeIndexAt(setup, ms), rotation(setup, ms).changeIndex, `elapsed ${ms}`);
  }
});

/* ----------------------------------------------------------- late arrival */

console.log('\nlate arrival');

test('a late arrival waits on the bench and comes on at the next change', () => {
  const before = kickOff(setupOf(8, 8), dice(3));
  const interval = computeIntervalMs(before);
  const elapsed = 2 * interval + 90000; // part way through change 2
  const was = rotation(before, elapsed).teams[0];

  const after = addLateArrival(before, 0, 'Wren', elapsed);
  const now = rotation(after, elapsed).teams[0];

  eq(now.keeper.id, was.keeper.id, 'the keeper does not change mid-shift');
  same(ids(now.onPitch), ids(was.onPitch), 'nobody on the pitch is disturbed');
  eq(now.subs.length, was.subs.length + 1, 'the bench grows by one');
  eq(now.subs[0].name, 'Wren', 'the newcomer is at the front of the bench');
  eq(now.comingOn[0].name, 'Wren', 'and comes on at the next change');
  ok(!ids(rotation(after, elapsed + interval).teams[0].subs).includes(now.subs[0].id));
});

test('a late arrival does not move the clock', () => {
  const before = kickOff(setupOf(8, 8), dice(3));
  const interval = computeIntervalMs(before);
  const elapsed = 2 * interval + 90000;
  const after = addLateArrival(before, 0, 'Wren', elapsed);
  eq(rotation(after, elapsed).intervalMs, interval);
  eq(rotation(after, elapsed).msToNextChange, rotation(before, elapsed).msToNextChange);
  eq(rotation(after, elapsed).changeIndex, 2);
});

test('a full team gains a bench, and still nobody on the pitch moves', () => {
  const before = kickOff(setupOf(6, 6), dice(9));
  const elapsed = 3 * computeIntervalMs(before) + 500;
  const was = rotation(before, elapsed).teams[0];
  const after = addLateArrival(before, 0, 'Wren', elapsed);
  const now = rotation(after, elapsed).teams[0];

  eq(was.subCount, 0);
  eq(now.subCount, 1);
  eq(now.subs[0].name, 'Wren');
  eq(now.keeper.id, was.keeper.id);
  same(ids(now.onPitch), ids(was.onPitch));
  checkRules(after, 0, 21, 'a bench arrived mid-game');
});

test('a short team puts the late arrival straight on', () => {
  const before = kickOff(setupOf(5, 6), dice(2));
  const elapsed = 2 * computeIntervalMs(before);
  const after = addLateArrival(before, 0, 'Wren', elapsed);
  const now = rotation(after, elapsed).teams[0];
  eq(now.subCount, 0);
  eq(now.onPitch.length + 1, 6, 'a full six on the pitch');
  ok(ids(now.onPitch).includes(after.teams[0].players.find((p) => p.name === 'Wren').id));
});

test('a late arrival joins the order once and the other team is untouched', () => {
  const before = kickOff(setupOf(7, 7), dice(5));
  const after = addLateArrival(before, 0, 'Wren', 3 * computeIntervalMs(before));
  const names = after.teams[0].players.map((player) => player.name);
  eq(names.filter((name) => name === 'Wren').length, 1);
  eq(names.length, 8);
  same(after.teams[1], before.teams[1]);
});

test('a late arrival takes their turn in goal in the normal cycle', () => {
  const before = kickOff(setupOf(8, 8), dice(13));
  const interval = computeIntervalMs(before);
  const after = addLateArrival(before, 0, 'Wren', 2 * interval);
  const late = after.teams[0].players.find((player) => player.name === 'Wren');

  let turns = 0;
  for (let k = 2; k < 2 + 9; k += 1) {
    if (stateAt(after, 0, k).keeper.id === late.id) turns += 1;
  }
  eq(turns, 1, 'exactly one turn in goal per lap of nine');
});

test('two late arrivals both work and the ids stay unique', () => {
  const before = kickOff(setupOf(7, 7), dice(15));
  const interval = computeIntervalMs(before);
  const one = addLateArrival(before, 0, 'Wren', interval);
  const two = addLateArrival(one, 0, 'Vic', 2 * interval);
  eq(two.teams[0].players.length, 9);
  eq(new Set(ids(two.teams[0].players)).size, 9);
  checkRules(two, 0, 27, 'two late arrivals');
});

test('a late arrival never disturbs the pitch, even after a team has been short', () => {
  for (let g = MIN_GAME_TYPE; g <= MAX_GAME_TYPE; g += 1) {
    const random = dice(g * 7);
    let setup = kickOff(setupOf(g + 1, g + 1, { gameType: g }), dice(g));
    let elapsed = 0;
    for (let round = 0; round < 24; round += 1) {
      elapsed += computeIntervalMs(setup) + 4321;
      const team = setup.teams[0];
      const shrink = team.players.length > 2 && random() < 0.45;
      if (shrink) {
        setup = removePlayer(setup, 0, team.players[Math.floor(random() * team.players.length)].id, elapsed);
        continue;
      }

      const was = rotation(setup, elapsed).teams[0];
      const after = addLateArrival(setup, 0, `Late${round}`, elapsed);
      const now = rotation(after, elapsed).teams[0];
      const newcomer = after.teams[0].players.find((player) => player.name === `Late${round}`);
      const label = `${g} a side, squad ${team.players.length}, round ${round}`;

      eq(now.keeper.id, was.keeper.id, `${label}: the keeper moved`);
      same(ids(now.subs).filter((id) => id !== newcomer.id), ids(was.subs), `${label}: the bench moved`);
      same(ids(now.onPitch).filter((id) => id !== newcomer.id), ids(was.onPitch), `${label}: the pitch moved`);
      checkRules(after, 0, 2 * after.teams[0].players.length, label);
      setup = after;
    }
  }
});

test('a blank late arrival name is ignored', () => {
  const before = kickOff(setupOf(7, 7), dice(1));
  same(addLateArrival(before, 0, '   ', 0), before);
});

/* -------------------------------------------------------------- gone home */

console.log('\ngone home');

test('a removed player never comes up again, in goal or on the bench', () => {
  const before = kickOff(setupOf(9, 9), dice(21));
  const elapsed = 3 * computeIntervalMs(before) + 1000;
  const victim = before.teams[0].players[5];

  const after = removePlayer(before, 0, victim.id, elapsed);
  eq(after.teams[0].players.length, 8);
  for (let k = 0; k < 40; k += 1) {
    const team = stateAt(after, 0, k);
    ok(team.keeper.id !== victim.id, `back in goal at change ${k}`);
    ok(!ids(team.subs).includes(victim.id), `back on the bench at change ${k}`);
    ok(!ids(team.onPitch).includes(victim.id), `back on the pitch at change ${k}`);
  }
});

test('removing anyone but the keeper never changes the keeper', () => {
  const before = kickOff(setupOf(9, 9), dice(22));
  const interval = computeIntervalMs(before);
  for (let k = 0; k < 12; k += 1) {
    const elapsed = k * interval + 1000;
    const keeper = rotation(before, elapsed).teams[0].keeper;
    for (const player of before.teams[0].players) {
      if (player.id === keeper.id) continue;
      const after = removePlayer(before, 0, player.id, elapsed);
      eq(rotation(after, elapsed).teams[0].keeper.id, keeper.id, `change ${k}, removed ${player.name}`);
    }
  }
});

test('if the keeper goes home, the player who was due next goes in now', () => {
  const before = kickOff(setupOf(9, 9), dice(23));
  const interval = computeIntervalMs(before);
  const elapsed = 5 * interval + 2000;
  const was = rotation(before, elapsed).teams[0];

  const after = removePlayer(before, 0, was.keeper.id, elapsed);
  eq(rotation(after, elapsed).teams[0].keeper.id, was.nextKeeper.id);
  checkRules(after, 0, 24, 'the keeper went home');
});

test('a removal fills the hole on the pitch from the bench', () => {
  const before = kickOff(setupOf(9, 9), dice(24));
  const elapsed = 4 * computeIntervalMs(before) + 10;
  const was = rotation(before, elapsed).teams[0];
  const leaver = was.onPitch[1];

  const after = removePlayer(before, 0, leaver.id, elapsed);
  const now = rotation(after, elapsed).teams[0];
  eq(now.onPitch.length, was.onPitch.length, 'the pitch is full again');
  eq(now.subs.length, was.subs.length - 1, 'and the bench is one shorter');
  eq(now.keeper.id, was.keeper.id);
});

test('removing a sub leaves the pitch alone', () => {
  const before = kickOff(setupOf(9, 9), dice(25));
  const elapsed = 2 * computeIntervalMs(before) + 10;
  const was = rotation(before, elapsed).teams[0];

  const after = removePlayer(before, 0, was.subs[1].id, elapsed);
  const now = rotation(after, elapsed).teams[0];
  same(ids(now.onPitch), ids(was.onPitch));
  eq(now.keeper.id, was.keeper.id);
  eq(now.subs.length, was.subs.length - 1);
});

test('removing a player does not move the clock', () => {
  const before = kickOff(setupOf(8, 6), dice(26));
  const elapsed = 4 * computeIntervalMs(before) + 12345;
  const after = removePlayer(before, 0, before.teams[0].players[2].id, elapsed);
  eq(rotation(after, elapsed).intervalMs, rotation(before, elapsed).intervalMs);
  eq(rotation(after, elapsed).msToNextChange, rotation(before, elapsed).msToNextChange);
  eq(rotation(after, elapsed).changeIndex, rotation(before, elapsed).changeIndex);
});

test('the other team is untouched by a removal, and an unknown id changes nothing', () => {
  const before = kickOff(setupOf(8, 7), dice(27));
  const after = removePlayer(before, 0, before.teams[0].players[1].id, 100000);
  same(after.teams[1], before.teams[1]);
  same(removePlayer(before, 0, 'nobody', 100000), before);
});

test('a team emptied by removals does not crash the engine', () => {
  let setup = kickOff(setupOf(6, 6), dice(28));
  for (const player of setup.teams[0].players.slice()) {
    setup = removePlayer(setup, 0, player.id, 100000);
  }
  const state = rotation(setup, 100000);
  eq(state.teams[0].keeper, null);
  eq(state.teams[0].subs.length, 0);
  eq(state.teams[0].onPitch.length, 0);
  eq(state.teams[0].order.length, 0);
  eq(state.teams[0].comingOn.length, 0);
  ok(state.teams[1].keeper !== null, 'the other team plays on');
});

test('a late arrival and a removal work together', () => {
  const kicked = kickOff(setupOf(7, 7), dice(29));
  const interval = computeIntervalMs(kicked);

  const withLate = addLateArrival(kicked, 0, 'Wren', 2 * interval + 1000);
  const keeperNow = rotation(withLate, 4 * interval + 500).teams[0].keeper;
  const gone = removePlayer(withLate, 0, withLate.teams[0].players[0].id, 4 * interval + 500);

  eq(rotation(gone, 4 * interval + 500).teams[0].keeper.id, keeperNow.id);
  eq(gone.teams[0].players.length, 7);
  eq(computeIntervalMs(gone), interval, 'the clock never moved');
  checkRules(gone, 0, 21, 'one in, one out');
});

/* ----------------------------------------------------------------- purity */

console.log('\npurity');

test('the same inputs always give the same output', () => {
  const setup = kickOff(setupOf(8, 7), dice(31));
  for (const ms of [0, 1, 331000, 5400000, 12345678]) {
    same(rotation(setup, ms), rotation(setup, ms), `elapsed ${ms}`);
  }
});

test('a setup written to JSON and read back behaves identically — a dead phone recovers', () => {
  let setup = kickOff(setupOf(8, 7), dice(32));
  setup = addLateArrival(setup, 0, 'Wren', 1200000);
  setup = removePlayer(setup, 1, setup.teams[1].players[3].id, 1800000);
  const restored = JSON.parse(JSON.stringify(setup));
  for (const ms of [0, 331000, 5400000, 12345678]) {
    same(rotation(restored, ms), rotation(setup, ms), `elapsed ${ms}`);
  }
});

test('rotation does not touch the setup', () => {
  const setup = kickOff(setupOf(8, 7), dice(33));
  const snapshot = JSON.stringify(setup);
  rotation(setup, 0);
  rotation(setup, 4000000);
  eq(JSON.stringify(setup), snapshot);
});

test('the result holds copies — the caller cannot reach into the setup', () => {
  const setup = kickOff(setupOf(8, 7), dice(34));
  const snapshot = JSON.stringify(setup);
  const state = rotation(setup, 0);
  state.teams[0].keeper.name = 'Wrecked';
  state.teams[0].order[0].name = 'Wrecked';
  state.teams[0].order.push({ id: 'x', name: 'Wrecked' });
  state.teams[0].subs[0].name = 'Wrecked';
  eq(JSON.stringify(setup), snapshot);
  ok(rotation(setup, 0).teams[0].keeper.name !== 'Wrecked');
});

test('the helpers do not touch the setup they are given', () => {
  const setup = kickOff(setupOf(8, 7), dice(35));
  const snapshot = JSON.stringify(setup);
  addLateArrival(setup, 0, 'Wren', 900000);
  removePlayer(setup, 1, setup.teams[1].players[0].id, 900000);
  setStartKeeper(setup, 0, 2);
  kickOff(setup, dice(36));
  eq(JSON.stringify(setup), snapshot);
});

test('the roster helpers are pure — same call, same new setup', () => {
  const setup = kickOff(setupOf(8, 7), dice(37));
  same(addLateArrival(setup, 0, 'Wren', 900000), addLateArrival(setup, 0, 'Wren', 900000));
  same(
    removePlayer(setup, 0, setup.teams[0].players[3].id, 900000),
    removePlayer(setup, 0, setup.teams[0].players[3].id, 900000)
  );
});

test('createSetup is pure — same names in, same setup out', () => {
  same(setupOf(8, 7), setupOf(8, 7));
});

/* ------------------------------------------------------------ edge cases */

console.log('\nedges');

test('an empty setup does not throw', () => {
  const state = rotation(createSetup({}), 0);
  eq(state.teams.length, 0);
  /* no squad is N = 1: two hours, one imaginary player, twice each */
  eq(state.intervalMs, 60 * MS_PER_MINUTE);
});

test('a team of one turns over on its own', () => {
  const setup = kickOff(setupOf(1, 6), dice(41));
  const team = stateAt(setup, 0, 3);
  eq(team.keeper.name, 'Zoe');
  eq(team.subs.length, 0);
  eq(team.onPitch.length, 0);
  eq(team.nextKeeper.name, 'Zoe');
});

test('a game type of two falls back to the whole line-up and still answers', () => {
  const setup = { ...setupOf(5, 5), gameType: 2 };
  same(legalStartKeepers(setup, 0), [0, 1], 'no legal window exists at two a side');
  const team = stateAt(setup, 0, 0);
  eq(team.subCount, 3);
  eq(team.onPitch.length, 1);
  ok(team.keeper !== null);
  for (let k = 0; k < 10; k += 1) ok(stateAt(setup, 0, k).keeper !== null, `change ${k}`);
});

test('eleven a side with a bench of five holds every rule for three laps', () => {
  const setup = kickOff(setupOf(16, 16, { gameType: 11, intervalMs: 4 * MS_PER_MINUTE }), dice(42));
  eq(rotation(setup, 0).teams[0].subCount, 5);
  eq(computeIntervalMs(setup), 4 * MS_PER_MINUTE);
  checkRules(setup, 0, 48, 'eleven a side');
});

/* ------------------------------------------------------------------ report */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nfailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
