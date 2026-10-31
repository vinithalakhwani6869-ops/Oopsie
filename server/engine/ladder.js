// ---------------------------------------------------------------------------
// The Hint Ladder — the one piece of logic every mode reuses.
//
// 0 hints used -> a correct answer is worth 3 points
// 1 hint       -> 2
// 2 hints      -> 1
// 3 hints      -> 0
// A wrong answer after the third hint reveals the solution.
// ---------------------------------------------------------------------------

export const MAX_HINTS = 3;

export function pointsFor(hintsUsed) {
  const used = Math.max(0, Math.min(MAX_HINTS, Number(hintsUsed) || 0));
  return MAX_HINTS - used;
}

export function nextHintLevel(hintsUsed) {
  const next = (Number(hintsUsed) || 0) + 1;
  return next <= MAX_HINTS ? next : null;
}

export const HINT_LABELS = [
  { level: 1, short: 'Nudge', label: 'Conceptual nudge', blurb: 'Names the right area — no steps.' },
  { level: 2, short: 'Slip', label: 'Find the slip', blurb: 'Points at where your reasoning diverged.' },
  { level: 3, short: 'Almost', label: 'Nearly there', blurb: 'The next move, without the answer.' },
];

const normalizeText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9.%+/=-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Best-effort guard against an LLM accidentally putting the final answer in a
 * hint. Runs server-side before the hint can reach the client.
 */
export function hintLeaksAnswer(hint, answerKey) {
  const h = normalizeText(hint);
  const key = normalizeText(answerKey);
  if (!h || !key) return false;

  // Multi-character answers: reject direct containment.
  if (key.length >= 4 && h.includes(key)) return true;

  // Short answers: only reject when the hint frames it as the result.
  if (key.length > 0 && key.length < 4) {
    const token = new RegExp(`(^|\\s)${escapeRegExp(key)}(\\s|$|[,.;:!?])`, 'i');
    if (/\b(answer|result|solution|equals?|comes to|yields?|total is|value is)\b/i.test(hint) && token.test(h)) {
      return true;
    }
  }

  // Numbers in the answer (with length >= 2) should not appear verbatim.
  const numbers = String(answerKey).match(/-?\d+(?:\.\d+)?/g) || [];
  for (const raw of numbers) {
    const clean = raw.replace(/[^0-9]/g, '');
    if (clean.length < 2) continue;
    if (new RegExp(`(^|\\D)${escapeRegExp(raw)}(\\D|$)`).test(hint)) return true;
  }

  return false;
}

export function fallbackHint(level, conceptTag = 'the core idea') {
  const tag = conceptTag || 'the core idea';
  if (level <= 1) {
    return `Take a step back. This question is testing ${tag}. Before touching the numbers or options, which principle or definition actually applies here?`;
  }
  if (level === 2) {
    return `Look for the first place your reasoning diverges from the setup — not the last. Re-read your answer and name the assumption you made. That assumption is the slip worth testing.`;
  }
  return `You're close. Write down the very next relationship or quantity the question asks for, then check it against the conditions and units before you finish. Leave the final calculation to yourself.`;
}

// Local checks let us skip an LLM call for the obvious cases.
export function mcqMatches(answer, answerKey) {
  return normalizeText(answer) === normalizeText(answerKey);
}

export function numericMatches(answer, answerKey, tolerance = 0.005) {
  const parse = (value) => {
    const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  };
  const a = parse(answer);
  const k = parse(answerKey);
  if (a === null || k === null) return false;
  if (a === k) return true;
  return Math.abs(a - k) <= Math.max(Math.abs(k) * tolerance, 1e-9);
}

export function stringAttemptCorrect(answer, answerKey) {
  return normalizeText(answer) === normalizeText(answerKey);
}
