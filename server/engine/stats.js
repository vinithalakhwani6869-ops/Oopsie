// Pure stats helpers — no database, no framework. Easy to unit test.
import { pointsFor } from './ladder.js';

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function utcDate(offsetDays = 0, from = new Date()) {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

function shiftKey(key, days) {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
}

export function countByDay(attempts) {
  const counts = new Map();
  for (const attempt of attempts) {
    const key = dayKey(attempt.created_at);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function computeStreaks(attempts, today = new Date()) {
  const counts = countByDay(attempts);
  const active = (key) => (counts.get(key) || 0) > 0;

  let current = 0;
  let cursor = dayKey(utcDate(0, today));
  if (!active(cursor)) cursor = shiftKey(cursor, -1);
  while (active(cursor)) {
    current += 1;
    cursor = shiftKey(cursor, -1);
  }

  const keys = [...counts.keys()].sort();
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const key of keys) {
    run = previous && shiftKey(previous, 1) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }

  return { current, longest };
}

export function buildHeatmap(attempts, { today = new Date(), days = 365 } = {}) {
  const counts = countByDay(attempts);
  const end = utcDate(0, today);
  const cells = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = dayKey(date);
    const count = counts.get(key) || 0;
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
    cells.push({ date: key, count, level });
  }
  return cells;
}

/**
 * Mastery for one topic = weighted average of the last 10 scored attempts.
 * attempt ratio = points / 3. Weights increase with recency (oldest = 1,
 * newest = n). Score is 0–100.
 */
export function computeMastery(attemptsNewestFirst, limit = 10) {
  const last = attemptsNewestFirst.slice(0, limit);
  if (!last.length) {
    return {
      score: 0,
      sample: 0,
      entries: [],
      weighted_sum: 0,
      weight_total: 0,
      formula:
        'Score = Σ((points ÷ 3) × recency weight) ÷ Σ(recency weight). The newest of your last 10 scored attempts gets the highest weight.',
    };
  }

  const oldestFirst = [...last].reverse();
  const entries = oldestFirst.map((attempt, index) => {
    const weight = index + 1;
    const ratio = (Number(attempt.points) || 0) / 3;
    return {
      id: attempt.id,
      at: attempt.created_at,
      points: Number(attempt.points) || 0,
      potential: pointsFor(attempt.hints_used),
      hints_used: attempt.hints_used,
      status: attempt.status,
      mode: attempt.mode,
      weight,
      ratio: round(ratio, 3),
      contribution: round(ratio * weight, 3),
    };
  });

  const weightedSum = entries.reduce((sum, entry) => sum + entry.contribution, 0);
  const weightTotal = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const score = weightTotal ? (weightedSum / weightTotal) * 100 : 0;

  return {
    score: Math.round(score),
    sample: entries.length,
    entries,
    weighted_sum: round(weightedSum, 3),
    weight_total: weightTotal,
    formula:
      'Score = Σ((points ÷ 3) × recency weight) ÷ Σ(recency weight), shown as a percentage. Weights run 1, 2, 3 … with the newest attempt weighted highest (max 10 attempts).',
  };
}
