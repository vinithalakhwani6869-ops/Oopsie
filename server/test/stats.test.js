import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeatmap,
  computeMastery,
  computeStreaks,
  countByDay,
  dayKey,
} from '../engine/stats.js';

const at = (date) => ({ created_at: `${date}T12:00:00.000Z` });

test('dayKey uses the UTC calendar day', () => {
  assert.equal(dayKey('2026-05-10T23:59:59.000Z'), '2026-05-10');
  assert.equal(dayKey(new Date('2026-05-11T00:00:00.000Z')), '2026-05-11');
});

test('countByDay groups attempts by UTC day', () => {
  const counts = countByDay([at('2026-05-10'), at('2026-05-10'), at('2026-05-09')]);
  assert.equal(counts.get('2026-05-10'), 2);
  assert.equal(counts.get('2026-05-09'), 1);
  assert.equal(counts.size, 2);
});

test('computeStreaks counts through today', () => {
  const today = new Date('2026-05-10T18:00:00.000Z');
  const attempts = [at('2026-05-08'), at('2026-05-09'), at('2026-05-10')];
  assert.deepEqual(computeStreaks(attempts, today), { current: 3, longest: 3 });
});

test('computeStreaks keeps a streak alive from yesterday', () => {
  const today = new Date('2026-05-10T18:00:00.000Z');
  const attempts = [at('2026-05-08'), at('2026-05-09')];
  assert.deepEqual(computeStreaks(attempts, today), { current: 2, longest: 2 });
});

test('computeStreaks breaks when the last active day is older', () => {
  const today = new Date('2026-05-10T18:00:00.000Z');
  const attempts = [at('2026-05-07'), at('2026-05-08')];
  assert.deepEqual(computeStreaks(attempts, today), { current: 0, longest: 2 });
});

test('computeStreaks tracks the longest run separately from the current one', () => {
  const today = new Date('2026-05-20T12:00:00.000Z');
  const attempts = [
    at('2026-05-01'),
    at('2026-05-02'),
    at('2026-05-03'),
    at('2026-05-04'),
    at('2026-05-19'),
    at('2026-05-20'),
  ];
  assert.deepEqual(computeStreaks(attempts, today), { current: 2, longest: 4 });
});

test('buildHeatmap returns 365 UTC days ending today with levels', () => {
  const today = new Date('2026-05-10T12:00:00.000Z');
  const attempts = [
    ...Array.from({ length: 1 }, () => at('2026-05-10')),
    ...Array.from({ length: 3 }, () => at('2026-05-09')),
    ...Array.from({ length: 5 }, () => at('2026-05-08')),
    ...Array.from({ length: 7 }, () => at('2026-05-07')),
  ];
  const cells = buildHeatmap(attempts, { today });

  assert.equal(cells.length, 365);
  assert.equal(cells.at(-1).date, '2026-05-10');
  assert.equal(cells.at(-2).date, '2026-05-09');
  assert.equal(cells.at(-1).level, 1);
  assert.equal(cells.at(-2).level, 2);
  assert.equal(cells.at(-3).level, 3);
  assert.equal(cells.at(-4).level, 4);
  assert.equal(cells[0].date, '2025-05-11');
});

test('computeMastery weights newer attempts more heavily', () => {
  const rows = [
    { id: 'new', points: 3, hints_used: 0, status: 'solved', mode: 'practice', created_at: '2026-05-10T12:00:00.000Z' },
    { id: 'old', points: 0, hints_used: 3, status: 'revealed', mode: 'practice', created_at: '2026-05-09T12:00:00.000Z' },
  ];
  const mastery = computeMastery(rows);

  assert.equal(mastery.sample, 2);
  assert.equal(mastery.weight_total, 3);
  assert.equal(mastery.weighted_sum, 2);
  // (0 * 1 + 1 * 2) / 3 = 0.6667 -> 67
  assert.equal(mastery.score, 67);
  assert.deepEqual(
    mastery.entries.map((entry) => [entry.id, entry.weight, entry.ratio]),
    [
      ['old', 1, 0],
      ['new', 2, 1],
    ],
  );
  assert.match(mastery.formula, /recency weight/i);
});

test('computeMastery caps the window at ten attempts', () => {
  const rows = Array.from({ length: 14 }, (_, index) => ({
    id: `a${index}`,
    points: 3,
    hints_used: 0,
    status: 'solved',
    mode: 'practice',
    created_at: `2026-05-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
  }));
  const mastery = computeMastery(rows);
  assert.equal(mastery.sample, 10);
  assert.equal(mastery.weight_total, 55);
  assert.equal(mastery.score, 100);
});

test('computeMastery handles an empty sample', () => {
  const mastery = computeMastery([]);
  assert.equal(mastery.score, 0);
  assert.equal(mastery.sample, 0);
  assert.deepEqual(mastery.entries, []);
  assert.match(mastery.formula, /Score =/);
});
