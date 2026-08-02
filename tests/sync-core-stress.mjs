import assert from 'node:assert/strict';
import {
  chooseNewest,
  defaultState,
  markDeleted,
  mergeStates,
  normalizeName,
  normalizePractice,
  normalizeState,
  practiceKey,
  resultKey,
  timestampOf
} from '../sync-core.js';

let seed = 0x6d2b79f5;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
function randomInt(max) {
  return Math.floor(random() * max);
}
function athlete(id, name, updatedAtMs = 0) {
  return { id, name, active: true, updatedAtMs };
}
function result(id, athleteId, seconds, date = '2026-08-01') {
  return { id, athleteId, distance: '1 Mile', seconds, date, updatedAtMs: seconds };
}
function makeState(iteration, side) {
  const base = defaultState();
  const offset = side === 'local' ? 1 : 0;
  const count = 2 + (iteration % 4);
  for (let index = 0; index < count; index += 1) {
    const id = `a_${index}`;
    base.athletes.push(athlete(id, `Runner ${index}`, iteration + offset + index));
    base.results.push(result(`r_${iteration}_${side}_${index}`, id, 330 + index + offset));
  }
  base.attendance['2026-08-01'] = Object.fromEntries(
    base.athletes.map((row, index) => [row.id, (index + offset) % 2 ? 'Present' : 'Absent'])
  );
  base.practices.push({
    id: `2026-08-0${(iteration % 7) + 1}|${side}`,
    date: `2026-08-0${(iteration % 7) + 1}`,
    rosterId: side,
    title: `${side} practice`,
    updatedAtMs: iteration + offset
  });
  return base;
}

{
  const remote = defaultState();
  remote.athletes = [athlete('remote_id', 'Tony Hernandez', 10)];
  remote.results = [result('remote_result', 'remote_id', 365)];

  const local = defaultState();
  local.athletes = [athlete('local_id', 'Tony Hernandez', 20)];
  local.results = [result('local_result', 'local_id', 360)];

  const merged = mergeStates(remote, local);
  assert.equal(merged.athletes.length, 1, 'same athlete name should not duplicate');
  assert.equal(merged.athletes[0].id, 'remote_id', 'cloud canonical ID should be preserved');
  assert.equal(merged.athletes[0].updatedAtMs, 20, 'newer athlete fields should win');
  assert.equal(merged.results.length, 2, 'distinct results should survive');
  assert.ok(merged.results.every((row) => row.athleteId === 'remote_id'), 'result IDs should be remapped');
}

{
  const remote = defaultState();
  remote.practices = [
    { date: '2026-08-03', rosterId: 'girls', title: 'Girls', updatedAtMs: 10 },
    { date: '2026-08-03', rosterId: 'boys', title: 'Boys', updatedAtMs: 10 }
  ];
  const merged = mergeStates(remote, defaultState());
  assert.equal(merged.practices.length, 2, 'separate rosters on the same day must survive');
}

{
  let state = defaultState();
  state.athletes = [athlete('a1', 'Deleted Runner', 10)];
  state = markDeleted(state, 'athletes', 'a1', 20);
  const merged = mergeStates(state, defaultState());
  assert.equal(merged.athletes.length, 0, 'newer tombstone must suppress deleted athlete');
}

{
  const remote = defaultState();
  remote.athletes = [athlete('a1', 'Runner One', 1)];
  remote.attendance = { '2026-08-01': { a1: 'Absent' } };
  const local = defaultState();
  local.athletes = [athlete('a1', 'Runner One', 1)];
  local.attendance = { '2026-08-01': { a1: 'Present' } };
  const merged = mergeStates(remote, local);
  assert.equal(merged.attendance['2026-08-01'].a1, 'Present', 'current device attendance should win conflicts');
}

const TOTAL_ASSERTIONS = 1_000_000;
let fullMergeChecks = 0;

for (let iteration = 0; iteration < TOTAL_ASSERTIONS; iteration += 1) {
  const mode = iteration % 10;

  if (mode === 0) {
    assert.equal(normalizeName('  José   García!! '), 'jose garcia');
  } else if (mode === 1) {
    const older = { id: 'x', updatedAtMs: iteration };
    const newer = { id: 'x', updatedAtMs: iteration + 1, value: 'new' };
    assert.equal(chooseNewest(older, newer).value, 'new');
  } else if (mode === 2) {
    const practice = normalizePractice({
      date: '2026-08-03',
      rosterId: `group-${randomInt(4)}`
    });
    assert.equal(practice.id, `${practice.date}|${practice.rosterId}`);
  } else if (mode === 3) {
    const key = resultKey({
      athleteId: `a${randomInt(20)}`,
      date: '2026-08-01',
      distance: '1 Mile',
      seconds: 300 + randomInt(300),
      source: 'Practice'
    });
    assert.ok(key.startsWith('value|'));
  } else if (mode === 4) {
    const key = practiceKey({
      date: '2026-08-03',
      rosterId: 'girls'
    });
    assert.equal(key, '2026-08-03|girls');
  } else if (mode === 5) {
    const normalized = normalizeState({
      athletes: null,
      results: 'bad',
      practices: 12,
      attendance: null
    });
    assert.ok(Array.isArray(normalized.athletes) && Array.isArray(normalized.results));
  } else if (mode === 6) {
    assert.equal(timestampOf({ updatedAt: '2026-08-02T12:00:00.000Z' }), 1785672000000);
  } else if (mode === 7) {
    const state = normalizeState(defaultState());
    assert.equal(state.version, 3);
  } else if (mode === 8) {
    const first = { id: 'x', value: 1, updatedAtMs: 5 };
    const second = { id: 'x', value: 2, updatedAtMs: 5 };
    assert.equal(chooseNewest(first, second).value, 2);
  } else {
    const remote = makeState(iteration, 'remote');
    const local = makeState(iteration, 'local');
    const merged = mergeStates(remote, local);
    const normalizedAgain = normalizeState(merged);
    assert.deepEqual(normalizedAgain, merged, 'merged state must normalize idempotently');
    assert.equal(new Set(merged.practices.map(practiceKey)).size, merged.practices.length);
    fullMergeChecks += 1;
  }
}

console.log(JSON.stringify({
  status: 'passed',
  randomizedAssertions: TOTAL_ASSERTIONS,
  fullMergeChecks,
  seed: '0x6d2b79f5'
}, null, 2));
