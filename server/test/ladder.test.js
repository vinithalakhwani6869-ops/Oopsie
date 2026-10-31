import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HINTS,
  fallbackHint,
  hintLeaksAnswer,
  mcqMatches,
  nextHintLevel,
  numericMatches,
  pointsFor,
} from '../engine/ladder.js';

test('pointsFor follows the hint ladder', () => {
  assert.equal(pointsFor(0), 3);
  assert.equal(pointsFor(1), 2);
  assert.equal(pointsFor(2), 1);
  assert.equal(pointsFor(3), 0);
});

test('pointsFor clamps out-of-range and invalid input', () => {
  assert.equal(pointsFor(-4), 3);
  assert.equal(pointsFor(99), 0);
  assert.equal(pointsFor(null), 3);
  assert.equal(pointsFor('2'), 1);
  assert.equal(pointsFor('nonsense'), 3);
});

test('nextHintLevel stops after the third hint', () => {
  assert.equal(nextHintLevel(0), 1);
  assert.equal(nextHintLevel(1), 2);
  assert.equal(nextHintLevel(2), 3);
  assert.equal(nextHintLevel(MAX_HINTS), null);
  assert.equal(nextHintLevel(9), null);
});

test('hintLeaksAnswer flags a long answer quoted directly', () => {
  assert.equal(hintLeaksAnswer('The result is photosynthesis, obviously.', 'photosynthesis'), true);
  assert.equal(hintLeaksAnswer('Think about how plants convert light.', 'photosynthesis'), false);
});

test('hintLeaksAnswer catches multi-digit answers anywhere in the hint', () => {
  assert.equal(hintLeaksAnswer('You should land on 240 after the conversion.', '240 km'), true);
  assert.equal(hintLeaksAnswer('Multiply the rate by the time first.', '240 km'), false);
});

test('hintLeaksAnswer only flags short answers when framed as the result', () => {
  assert.equal(hintLeaksAnswer('The answer is 7.', '7'), true);
  assert.equal(hintLeaksAnswer('Consider the 7 possible orderings.', '7'), false);
});

test('hintLeaksAnswer ignores empty values and empty hints', () => {
  assert.equal(hintLeaksAnswer('', '42'), false);
  assert.equal(hintLeaksAnswer('Some hint', ''), false);
});

test('fallbackHint returns a distinct hint per level', () => {
  const hints = [1, 2, 3].map((level) => fallbackHint(level, 'unit conversion'));
  assert.equal(new Set(hints).size, 3);
  for (const hint of hints) {
    assert.ok(hint.length > 40);
  }
  assert.match(hints[0], /unit conversion/);
  assert.match(hints[1], /assumption/);
  assert.match(hints[2], /next relationship/);
});

test('mcqMatches normalizes case and whitespace', () => {
  assert.equal(mcqMatches('  Option   B ', 'option b'), true);
  assert.equal(mcqMatches('Option A', 'Option B'), false);
});

test('numericMatches accepts commas, decimals and tolerance', () => {
  assert.equal(numericMatches('1,200', '1200'), true);
  assert.equal(numericMatches('1200.01', '1200'), true);
  assert.equal(numericMatches('1190', '1200'), false);
  assert.equal(numericMatches('about 12.5 kg', '12.5'), true);
  assert.equal(numericMatches('not a number', '12.5'), false);
});
