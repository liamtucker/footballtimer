/*
 * test.js — plain assertions for rotation.js. Run: node test.js
 * Exits non-zero on any failure.
 */

import {
  rotation,
  createSetup,
  lockClock,
  computeIntervalMs,
  changeIndexAt,
  totalChangesIn,
  addLateArrival,
  removePlayer,
  QUANTUM_MS
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

const ALPHABET = ['Alex', 'Ben', 'Cara', 'Dan', 'Eve', 'Finn', 'Gus', 'Hal', 'Iris', 'Jo', 'Kai', 'Lena', 'Mo', 'Nia'];

/** Names in arrival order, deliberately not alphabetical. */
function arrivals(size) {
  const names = ALPHABET.slice(0, size);
  return names.slice().reverse();
}

function setupOf(sizeA, sizeB, options = {}) {
  return createSetup({
    durationMin: options.durationMin ?? 90,
    shiftsEach: options.shiftsEach ?? 2,
    teams: [
      { name: 'Bibs', arrivals: options.arrivalsA ?? arrivals(sizeA) },
      { name: 'No bibs', arrivals: options.arrivalsB ?? arrivals(sizeB) }
    ]
  });
}

function keeperAt(setup, teamIndex, changeIndex) {
  const interval = computeIntervalMs(setup);
  return rotation(setup, changeIndex * interval).teams[teamIndex].keeper;
}

function subsAt(setup, teamIndex, changeIndex) {
  const interval = computeIntervalMs(setup);
  return rotation(setup, changeIndex * interval).teams[teamIndex].subs;
}

/* ------------------------------------------------------ interval arithmetic */

console.log('\ninterval');

test('90 minutes, 6 a side, 2 shifts each — 7:30', () => {
  eq(computeIntervalMs(setupOf(6, 6)), 450000);
});

test('the larger squad sets the interval', () => {
  eq(computeIntervalMs(setupOf(6, 8)), 330000);
  eq(computeIntervalMs(setupOf(8, 6)), 330000);
});

test('the 15 second floor bites — 7 a side is 6:15, not 6:25.7', () => {
  const interval = computeIntervalMs(setupOf(7, 7));
  eq(interval, 375000);
  ok(interval < 5400000 / 14, 'floored down, never up');
});

test('the 15 second floor bites — 11 a side is 4:00', () => {
  eq(computeIntervalMs(setupOf(11, 6)), 240000);
});

test('every interval is a whole number of 15 second blocks', () => {
  for (let size = 2; size <= 14; size += 1) {
    for (let shifts = 1; shifts <= 4; shifts += 1) {
      for (const durationMin of [45, 60, 70, 90, 120]) {
        const interval = computeIntervalMs(setupOf(size, 6, { shiftsEach: shifts, durationMin }));
        eq(interval % QUANTUM_MS, 0, `${size} players, ${shifts} shifts, ${durationMin} min`);
        ok(interval >= QUANTUM_MS, 'never zero');
      }
    }
  }
});

test('more shifts each means a shorter interval', () => {
  ok(computeIntervalMs(setupOf(8, 8, { shiftsEach: 3 })) < computeIntervalMs(setupOf(8, 8, { shiftsEach: 2 })));
});

test('totalChanges is N x S', () => {
  eq(totalChangesIn(setupOf(8, 6)), 16);
  eq(totalChangesIn(setupOf(6, 6, { shiftsEach: 3 })), 18);
  eq(rotation(setupOf(8, 6), 0).totalChanges, 16);
});

/* --------------------------------------------------------------- sub count */

console.log('\nsubs per team');

test('a team of 6 has no sub', () => {
  const state = rotation(setupOf(6, 6), 0).teams[0];
  eq(state.subCount, 0);
  eq(state.subs.length, 0);
  eq(state.nextSubs.length, 0);
});

test('a team of 7 has one sub', () => {
  const state = rotation(setupOf(7, 7), 0).teams[0];
  eq(state.subCount, 1);
  eq(state.subs.length, 1);
});

test('a team of 8 has two subs', () => {
  const state = rotation(setupOf(8, 8), 0).teams[0];
  eq(state.subCount, 2);
  eq(state.subs.length, 2);
});

test('one team with a sub and one without is fine', () => {
  const state = rotation(setupOf(7, 6), 0);
  eq(state.teams[0].subs.length, 1);
  eq(state.teams[1].subs.length, 0);
});

/* ------------------------------------------------------------- the order */

console.log('\nthe order');

test('the order is alphabetical by first name, not arrival order', () => {
  const setup = setupOf(6, 6);
  same(
    setup.teams[0].players.map((player) => player.name),
    ['Alex', 'Ben', 'Cara', 'Dan', 'Eve', 'Finn']
  );
});

test('the first keeper is the last name entered', () => {
  const setup = setupOf(6, 6, { arrivalsA: ['Zoe', 'Alex', 'Sam', 'Ben', 'Cara', 'Dan'] });
  eq(rotation(setup, 0).teams[0].keeper.name, 'Dan');
});

test('the first keeper is the last name entered, even when alphabetically first', () => {
  const setup = setupOf(6, 6, { arrivalsA: ['Zoe', 'Sam', 'Ben', 'Cara', 'Dan', 'Alex'] });
  eq(rotation(setup, 0).teams[0].keeper.name, 'Alex');
});

test('the rota runs alphabetically from the first keeper and wraps', () => {
  const setup = setupOf(6, 6, { arrivalsA: ['Zoe', 'Alex', 'Sam', 'Ben', 'Cara', 'Dan'] });
  const order = ['Dan', 'Sam', 'Zoe', 'Alex', 'Ben', 'Cara'];
  for (let k = 0; k < 18; k += 1) {
    eq(keeperAt(setup, 0, k).name, order[k % 6], `change ${k}`);
  }
});

test('nextKeeper is the keeper of the following change', () => {
  const setup = setupOf(8, 7);
  const interval = computeIntervalMs(setup);
  for (let k = 0; k < 20; k += 1) {
    const now = rotation(setup, k * interval);
    const next = rotation(setup, (k + 1) * interval);
    for (let t = 0; t < 2; t += 1) {
      same(now.teams[t].nextKeeper, next.teams[t].keeper, `team ${t}, change ${k}`);
      same(now.teams[t].nextSubs, next.teams[t].subs, `team ${t} subs, change ${k}`);
    }
  }
});

test('duplicate first names still rotate as two separate players', () => {
  const setup = setupOf(6, 6, { arrivalsA: ['Sam', 'Sam', 'Ben', 'Cara', 'Dan', 'Eve'] });
  const ids = new Set(setup.teams[0].players.map((player) => player.id));
  eq(ids.size, 6);
  const seen = new Set();
  for (let k = 0; k < 6; k += 1) seen.add(keeperAt(setup, 0, k).id);
  eq(seen.size, 6, 'six distinct players in six changes');
});

/* ------------------------------------------------------------ the whole lap */

console.log('\nthe lap');

test('every player in the larger squad gets exactly S shifts in the duration', () => {
  for (const shiftsEach of [1, 2, 3]) {
    for (const size of [6, 7, 8, 9, 11]) {
      const setup = setupOf(size, 6, { shiftsEach });
      const counts = new Map();
      for (let k = 0; k < totalChangesIn(setup); k += 1) {
        const keeper = keeperAt(setup, 0, k);
        counts.set(keeper.id, (counts.get(keeper.id) ?? 0) + 1);
      }
      eq(counts.size, size, `${size} players get a turn`);
      for (const count of counts.values()) eq(count, shiftsEach, `${size} players, ${shiftsEach} shifts each`);
    }
  }
});

test('uneven teams: the larger squad gets exactly S, the smaller gets more', () => {
  const setup = setupOf(9, 6);
  const total = totalChangesIn(setup);
  eq(total, 18);

  const big = new Map();
  const small = new Map();
  for (let k = 0; k < total; k += 1) {
    const a = keeperAt(setup, 0, k);
    const b = keeperAt(setup, 1, k);
    big.set(a.id, (big.get(a.id) ?? 0) + 1);
    small.set(b.id, (small.get(b.id) ?? 0) + 1);
  }
  for (const count of big.values()) eq(count, 2, 'larger squad');
  eq(small.size, 6);
  for (const count of small.values()) eq(count, 3, 'smaller squad shares the same goal time between fewer people');
});

test('the rota keeps going past the duration and wraps', () => {
  const setup = setupOf(7, 7);
  const total = totalChangesIn(setup);
  for (let k = 0; k < 40; k += 1) {
    ok(keeperAt(setup, 0, k) !== null, `change ${k} still has a keeper`);
    eq(keeperAt(setup, 0, k).id, keeperAt(setup, 0, k + 7).id, `change ${k} repeats one lap later`);
  }
  const past = rotation(setup, (total + 5) * computeIntervalMs(setup) + 1000);
  eq(past.changeIndex, total + 5, 'the change index never stops');
  ok(past.teams[0].keeper !== null);
});

/* -------------------------------------------------------------- sub slots */

console.log('\nsub slots');

test('the sub is never the keeper', () => {
  for (let size = 6; size <= 14; size += 1) {
    const setup = setupOf(size, size);
    for (let k = 0; k < size * 3; k += 1) {
      const keeper = keeperAt(setup, 0, k);
      for (const sub of subsAt(setup, 0, k)) {
        ok(sub.id !== keeper.id, `squad of ${size}, change ${k}: ${sub.name} is both keeper and sub`);
      }
    }
  }
});

test('the sub is never the player who has just come out of goal', () => {
  // Holds up to 11 in a team. At 12 the subs are, unavoidably, everyone who is
  // not one of the six on the pitch, so the last keeper must sit down.
  for (let size = 6; size <= 11; size += 1) {
    const setup = setupOf(size, size);
    for (let k = 1; k < size * 3; k += 1) {
      const wasKeeper = keeperAt(setup, 0, k - 1);
      for (const sub of subsAt(setup, 0, k)) {
        ok(sub.id !== wasKeeper.id, `squad of ${size}, change ${k}: ${sub.name} came out of goal and sat down`);
      }
    }
  }
});

test('the subs are distinct players', () => {
  for (let size = 7; size <= 12; size += 1) {
    const setup = setupOf(size, size);
    for (let k = 0; k < size * 2; k += 1) {
      const subs = subsAt(setup, 0, k);
      eq(new Set(subs.map((sub) => sub.id)).size, subs.length, `squad of ${size}, change ${k}`);
    }
  }
});

test('every player takes the same number of bench shifts over a lap', () => {
  for (const size of [7, 8, 9]) {
    const setup = setupOf(size, size);
    const counts = new Map();
    for (const player of setup.teams[0].players) counts.set(player.id, 0);
    for (let k = 0; k < size; k += 1) {
      for (const sub of subsAt(setup, 0, k)) counts.set(sub.id, counts.get(sub.id) + 1);
    }
    for (const count of counts.values()) eq(count, size - 6, `squad of ${size}`);
  }
});

/* ------------------------------------------------------------- the clock */

console.log('\nthe clock');

test('elapsed 0 is change 0 with a full interval to run', () => {
  const setup = setupOf(8, 6);
  const state = rotation(setup, 0);
  eq(state.changeIndex, 0);
  eq(state.msToNextChange, state.intervalMs);
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

test('a late arrival is in goal at the very next change, and the clock does not move', () => {
  const before = lockClock(setupOf(7, 7));
  const interval = computeIntervalMs(before);
  const elapsed = 2 * interval + 90000; // part way through change 2
  const wasKeeper = rotation(before, elapsed).teams[0].keeper;
  const wasNext = rotation(before, elapsed).teams[0].nextKeeper;

  const after = addLateArrival(before, 0, 'Zoe', elapsed);
  const state = rotation(after, elapsed);

  eq(state.intervalMs, interval, 'the interval is frozen');
  eq(state.msToNextChange, rotation(before, elapsed).msToNextChange, 'the countdown does not move');
  eq(state.changeIndex, 2);
  eq(state.teams[0].keeper.id, wasKeeper.id, 'the current keeper does not change mid-shift');
  eq(state.teams[0].nextKeeper.name, 'Zoe', 'the late arrival is in goal at the next change');
  ok(wasNext.name !== 'Zoe');
});

test('a late arrival does not come round again inside a full lap', () => {
  const before = lockClock(setupOf(7, 7));
  const interval = computeIntervalMs(before);
  const elapsed = 2 * interval + 90000;
  const after = addLateArrival(before, 0, 'Zoe', elapsed);

  const lap = after.teams[0].players.length;
  eq(lap, 8);

  const covered = 3; // the change the late arrival covers
  eq(keeperAt(after, 0, covered).name, 'Zoe');
  for (let k = covered + 1; k < covered + lap; k += 1) {
    ok(keeperAt(after, 0, k).name !== 'Zoe', `back in goal too soon at change ${k}`);
  }
  eq(keeperAt(after, 0, covered + lap).name, 'Zoe', 'back in goal after exactly one lap');
});

test('the player who was due next is not lost, only pushed one change back', () => {
  const before = lockClock(setupOf(7, 7));
  const interval = computeIntervalMs(before);
  const elapsed = 2 * interval;
  const wasDue = rotation(before, elapsed).teams[0].nextKeeper;

  const after = addLateArrival(before, 0, 'Zoe', elapsed);
  eq(keeperAt(after, 0, 4).id, wasDue.id, 'they go in one change later');
});

test('a late arrival joins the goal order and shows in it once', () => {
  const before = lockClock(setupOf(7, 7));
  const after = addLateArrival(before, 0, 'Zoe', 3 * computeIntervalMs(before));
  const names = after.teams[0].players.map((player) => player.name);
  eq(names.filter((name) => name === 'Zoe').length, 1);
  eq(names.length, 8);
  eq(after.teams[1].players.length, 7, 'the other team is untouched');
});

test('a late arrival grows the sub count, not the interval', () => {
  const before = lockClock(setupOf(6, 6));
  eq(rotation(before, 0).teams[0].subCount, 0);
  const after = addLateArrival(before, 0, 'Zoe', 0);
  eq(rotation(after, 0).teams[0].subCount, 1);
  eq(computeIntervalMs(after), computeIntervalMs(before), 'the interval is frozen at kick-off');
});

test('two late arrivals both work', () => {
  const before = lockClock(setupOf(7, 7));
  const interval = computeIntervalMs(before);
  const one = addLateArrival(before, 0, 'Zoe', interval);
  const two = addLateArrival(one, 0, 'Yves', 2 * interval);
  eq(two.teams[0].players.length, 9);
  eq(keeperAt(one, 0, 2).name, 'Zoe');
  eq(keeperAt(two, 0, 2).name, 'Zoe', 'the second arrival does not disturb the current shift');
  eq(keeperAt(two, 0, 3).name, 'Yves');
  eq(new Set(two.teams[0].players.map((player) => player.id)).size, 9, 'ids stay unique');
});

test('a blank late arrival name is ignored', () => {
  const before = lockClock(setupOf(7, 7));
  same(addLateArrival(before, 0, '   ', 0), before);
});

/* -------------------------------------------------------------- gone home */

console.log('\ngone home');

test('a removed player never comes up again, in goal or on the bench', () => {
  const before = lockClock(setupOf(8, 8));
  const interval = computeIntervalMs(before);
  const elapsed = 3 * interval + 1000;
  const victim = before.teams[0].players[5];

  const after = removePlayer(before, 0, victim.id, elapsed);
  eq(after.teams[0].players.length, 7);

  for (let k = 0; k < 40; k += 1) {
    ok(keeperAt(after, 0, k).id !== victim.id, `back in goal at change ${k}`);
    for (const sub of subsAt(after, 0, k)) {
      ok(sub.id !== victim.id, `back on the bench at change ${k}`);
    }
  }
  ok(!after.teams[0].players.some((player) => player.id === victim.id), 'gone from the order');
});

test('removing a player never changes the current keeper', () => {
  const before = lockClock(setupOf(8, 8));
  const interval = computeIntervalMs(before);
  for (let k = 0; k < 16; k += 1) {
    const elapsed = k * interval + 1000;
    const keeper = rotation(before, elapsed).teams[0].keeper;
    for (const player of before.teams[0].players) {
      if (player.id === keeper.id) continue;
      const after = removePlayer(before, 0, player.id, elapsed);
      eq(rotation(after, elapsed).teams[0].keeper.id, keeper.id, `change ${k}, removed ${player.name}`);
    }
  }
});

test('if the keeper goes home, the player who was next goes in now', () => {
  const before = lockClock(setupOf(8, 8));
  const interval = computeIntervalMs(before);
  const elapsed = 5 * interval + 2000;
  const state = rotation(before, elapsed).teams[0];

  const after = removePlayer(before, 0, state.keeper.id, elapsed);
  eq(rotation(after, elapsed).teams[0].keeper.id, state.nextKeeper.id);
  eq(keeperAt(after, 0, 6).id, keeperAt(before, 0, 7).id, 'and the rota carries on from there');
});

test('removing a player does not move the clock', () => {
  const before = lockClock(setupOf(8, 6));
  const elapsed = 4 * computeIntervalMs(before) + 12345;
  const after = removePlayer(before, 0, before.teams[0].players[2].id, elapsed);
  eq(rotation(after, elapsed).intervalMs, rotation(before, elapsed).intervalMs);
  eq(rotation(after, elapsed).msToNextChange, rotation(before, elapsed).msToNextChange);
  eq(rotation(after, elapsed).changeIndex, rotation(before, elapsed).changeIndex);
});

test('removing a player shrinks the sub count', () => {
  const before = lockClock(setupOf(7, 7));
  eq(rotation(before, 0).teams[0].subCount, 1);
  const after = removePlayer(before, 0, before.teams[0].players[0].id, 0);
  eq(rotation(after, 0).teams[0].subCount, 0);
  eq(rotation(after, 0).teams[0].subs.length, 0);
});

test('the other team is untouched by a removal', () => {
  const before = lockClock(setupOf(8, 7));
  const after = removePlayer(before, 0, before.teams[0].players[1].id, 100000);
  same(after.teams[1], before.teams[1]);
});

test('an unknown player id changes nothing', () => {
  const before = lockClock(setupOf(7, 7));
  same(removePlayer(before, 0, 'nobody', 100000), before);
});

test('a removed player can be put back by keeping the old setup — undo is free', () => {
  const before = lockClock(setupOf(8, 8));
  const elapsed = 3 * computeIntervalMs(before);
  const after = removePlayer(before, 0, before.teams[0].players[4].id, elapsed);
  ok(JSON.stringify(after) !== JSON.stringify(before));
  same(rotation(before, elapsed), rotation(before, elapsed));
});

test('a team emptied by removals does not crash the engine', () => {
  let setup = lockClock(setupOf(6, 6));
  for (const player of setup.teams[0].players.slice()) {
    setup = removePlayer(setup, 0, player.id, 100000);
  }
  const state = rotation(setup, 100000);
  eq(state.teams[0].keeper, null);
  eq(state.teams[0].subs.length, 0);
  eq(state.teams[0].order.length, 0);
  ok(state.teams[1].keeper !== null, 'the other team plays on');
});

test('a late arrival and a removal work together', () => {
  const kickOff = lockClock(setupOf(7, 7));
  const interval = computeIntervalMs(kickOff);

  const withZoe = addLateArrival(kickOff, 0, 'Zoe', 2 * interval + 1000);
  const keeperNow = rotation(withZoe, 4 * interval + 500).teams[0].keeper;
  const gone = removePlayer(withZoe, 0, withZoe.teams[0].players[0].id, 4 * interval + 500);

  eq(rotation(gone, 4 * interval + 500).teams[0].keeper.id, keeperNow.id);
  eq(gone.teams[0].players.length, 7);
  eq(computeIntervalMs(gone), interval, 'still frozen');
});

/* ----------------------------------------------------------------- purity */

console.log('\npurity');

test('the same inputs always give the same output', () => {
  const setup = setupOf(8, 7);
  for (const ms of [0, 1, 331000, 5400000, 12345678]) {
    same(rotation(setup, ms), rotation(setup, ms), `elapsed ${ms}`);
  }
});

test('a setup written to JSON and read back behaves identically — a dead phone recovers', () => {
  const setup = lockClock(setupOf(8, 7));
  const restored = JSON.parse(JSON.stringify(setup));
  for (const ms of [0, 331000, 5400000, 12345678]) {
    same(rotation(restored, ms), rotation(setup, ms), `elapsed ${ms}`);
  }
});

test('rotation does not touch the setup', () => {
  const setup = setupOf(8, 7);
  const snapshot = JSON.stringify(setup);
  rotation(setup, 0);
  rotation(setup, 4000000);
  eq(JSON.stringify(setup), snapshot);
});

test('the result holds copies — the caller cannot reach into the setup', () => {
  const setup = setupOf(8, 7);
  const snapshot = JSON.stringify(setup);
  const state = rotation(setup, 0);
  state.teams[0].keeper.name = 'Wrecked';
  state.teams[0].order[0].name = 'Wrecked';
  state.teams[0].order.push({ id: 'x', name: 'Wrecked' });
  eq(JSON.stringify(setup), snapshot);
  eq(rotation(setup, 0).teams[0].keeper.name !== 'Wrecked', true);
});

test('addLateArrival and removePlayer do not touch the setup they are given', () => {
  const setup = lockClock(setupOf(8, 7));
  const snapshot = JSON.stringify(setup);
  addLateArrival(setup, 0, 'Zoe', 900000);
  removePlayer(setup, 1, setup.teams[1].players[0].id, 900000);
  eq(JSON.stringify(setup), snapshot);
});

test('the roster helpers are pure — same call, same new setup', () => {
  const setup = lockClock(setupOf(8, 7));
  same(addLateArrival(setup, 0, 'Zoe', 900000), addLateArrival(setup, 0, 'Zoe', 900000));
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

test('a team of exactly 6 — no subs, and the rota still turns', () => {
  const setup = setupOf(6, 6);
  const state = rotation(setup, 0);
  eq(state.teams[0].subs.length, 0);
  eq(state.teams[0].nextSubs.length, 0);
  eq(state.teams[0].order.length, 6);
  ok(state.teams[0].keeper !== null);
  eq(state.intervalMs, 450000);
});

test('two teams of different sizes both work off one clock', () => {
  const setup = setupOf(9, 6);
  const state = rotation(setup, 4 * computeIntervalMs(setup) + 10);
  eq(state.teams[0].order.length, 9);
  eq(state.teams[1].order.length, 6);
  eq(state.teams[0].subs.length, 3);
  eq(state.teams[1].subs.length, 0);
  eq(state.changeIndex, 4, 'one clock, both teams change together');
});

test('a team of two — the smallest the setup screen allows', () => {
  const setup = setupOf(2, 6);
  const names = [];
  for (let k = 0; k < 4; k += 1) names.push(keeperAt(setup, 0, k).name);
  same(names, ['Alex', 'Ben', 'Alex', 'Ben']);
  eq(rotation(setup, 0).teams[0].subs.length, 0);
});

test('elapsed far past the duration still names a keeper and a sub', () => {
  const setup = setupOf(8, 7);
  const state = rotation(setup, 6 * 3600000); // six hours
  ok(state.teams[0].keeper !== null);
  eq(state.teams[0].subs.length, 2);
  eq(state.teams[1].subs.length, 1);
  ok(state.changeIndex > state.totalChanges);
});

test('an empty setup does not throw', () => {
  const setup = createSetup({});
  const state = rotation(setup, 0);
  eq(state.teams.length, 0);
  ok(state.intervalMs >= QUANTUM_MS);
});

test('lockClock is idempotent and freezes the larger squad size', () => {
  const setup = setupOf(8, 6);
  const locked = lockClock(setup);
  eq(locked.clockN, 8);
  eq(lockClock(locked), locked);
  const grown = addLateArrival(locked, 1, 'Zoe', 0);
  eq(grown.clockN, 8, 'still the kick-off value');
  eq(computeIntervalMs(grown), computeIntervalMs(locked));
});

test('a roster change before lockClock freezes the interval on the spot', () => {
  const setup = setupOf(7, 7); // clockN is null
  const before = computeIntervalMs(setup);
  const after = addLateArrival(setup, 0, 'Zoe', 0);
  eq(after.clockN, 7);
  eq(computeIntervalMs(after), before, 'the countdown never jumps under people');
});

/* ------------------------------------------------------------------ report */

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nfailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
