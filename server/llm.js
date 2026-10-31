import { z } from 'zod';
import { config } from './config.js';
import {
  generatedQuestionSchema,
  gradeSchema,
  hintSchema,
  selfStudySolutionSchema,
  flawedQuestionSchema,
  flawGradeSchema,
  lessonSchema,
} from './schemas.js';
import {
  SYSTEM_BASE,
  questionPrompt,
  similarQuestionPrompt,
  gradePrompt,
  hintPrompt,
  selfStudySolvePrompt,
  flawedQuestionPrompt,
  flawGradePrompt,
  lessonPrompt,
} from './prompts.js';

export class LlmError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
    this.code = 'llm_error';
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseJsonObject(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty model response.');
  let cleaned = text.trim().replace(/^\uFEFF/, '');
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function contentOf(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part?.text ?? '').join('');
  return '';
}

async function chat(messages, { temperature = 0.4, maxTokens = 1800 } = {}) {
  if (!config.llm.key) {
    throw new LlmError(503, 'The AI provider is not configured. Add LLM_API_KEY to server/.env.');
  }

  const body = {
    model: config.llm.model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (config.llm.jsonMode) body.response_format = { type: 'json_object' };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(config.llm.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.llm.key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.llm.timeoutMs),
      });
    } catch (err) {
      lastError = new LlmError(504, 'The AI took too long to respond. Please try again.');
      if (attempt === 0) {
        await sleep(700);
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      const brief = raw.slice(0, 400);
      if (response.status === 429) {
        throw new LlmError(503, 'The AI is busy right now. Try again in a minute.');
      }
      if (response.status >= 500 && attempt === 0) {
        lastError = new LlmError(502, 'The AI provider had a hiccup. Please try again.');
        await sleep(800);
        continue;
      }
      throw new LlmError(502, `The AI provider rejected the request (${response.status}). ${brief}`.trim());
    }

    const payload = await response.json().catch(() => null);
    const text = contentOf(payload);
    if (!text) {
      lastError = new LlmError(502, 'The AI returned an empty response. Please try again.');
      if (attempt === 0) {
        await sleep(500);
        continue;
      }
      throw lastError;
    }
    return text;
  }

  throw lastError || new LlmError(502, 'The AI request failed. Please try again.');
}

/**
 * Calls the model, parses strict JSON, runs an optional shape fixer, then
 * validates with zod. Retries once with the validation error fed back.
 */
export async function jsonLLM({ system = SYSTEM_BASE, user, schema, temperature, maxTokens, transform }) {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await chat(messages, { temperature, maxTokens });
    try {
      const parsed = parseJsonObject(text);
      const shaped = transform ? transform(parsed) : parsed;
      return schema.parse(shaped);
    } catch (err) {
      lastError = err;
      const reason =
        err instanceof z.ZodError
          ? err.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ')
          : err.message;
      messages.push({ role: 'assistant', content: text.slice(0, 6000) });
      messages.push({
        role: 'user',
        content: `That reply did not satisfy the required JSON contract (${reason}). Reply again with ONLY the corrected JSON object. No markdown, no commentary, include every required field.`,
      });
    }
  }

  console.error('[llm] unusable response after retry:', lastError?.message);
  throw new LlmError(502, 'The AI returned an unusable response. Please try again.');
}

const normalizeOption = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');

export function coerceQuestionShape(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const out = { ...raw };
  out.type = String(out.type || '').toLowerCase();

  if (out.type === 'mcq') {
    if (!Array.isArray(out.options) || out.options.length < 2 || out.options.length > 6) {
      throw new Error('mcq needs 2-6 options');
    }
    out.options = out.options.map((o) => String(o).trim()).filter(Boolean);
    const key = String(out.answer_key ?? '').trim();
    const target = normalizeOption(key);

    let match = out.options.find((o) => normalizeOption(o) === target);
    if (!match) {
      const unlabeled = key.replace(/^(?:option\s*)?[A-Fa-f][).:\s-]+/i, '').trim();
      match = out.options.find((o) => normalizeOption(o) === normalizeOption(unlabeled));
    }
    if (!match) {
      const letter = key.match(/^(?:option\s*)?\(?([a-f])\)?(?:[).:\s-]|$)/i)?.[1];
      if (letter) {
        const index = letter.toUpperCase().charCodeAt(0) - 65;
        match = out.options[index];
      }
    }
    if (!match) {
      const numericIndex = key.match(/^(\d+)$/)?.[1];
      if (numericIndex) {
        const index = Number(numericIndex) - 1;
        if (out.options[index]) match = out.options[index];
      }
    }
    if (!match) throw new Error('answer_key must exactly match one of the mcq options');
    out.answer_key = match;
  } else {
    out.options = null;
    out.answer_key = String(out.answer_key ?? '').trim();
  }

  out.source = 'generated';
  return out;
}

function coerceFlawShape(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const out = { ...raw };
  out.steps = Array.isArray(out.steps) ? out.steps.map((s) => String(s).trim()).filter(Boolean) : [];
  out.flawed_step = Number(out.flawed_step);
  if (out.steps.length < 3 || out.steps.length > 7) throw new Error('Flawed question needs 3-7 steps.');
  if (!Number.isInteger(out.flawed_step) || out.flawed_step < 1 || out.flawed_step > out.steps.length) {
    throw new Error('flawed_step must index one of the steps.');
  }
  return out;
}

// ---------------------------------------------------------------------------
// High-level helpers
// ---------------------------------------------------------------------------

export async function generateQuestion({ topicName, topicDescription, difficulty, avoid = [] }) {
  return jsonLLM({
    user: questionPrompt({ topicName, topicDescription, difficulty, avoid }),
    schema: generatedQuestionSchema,
    transform: coerceQuestionShape,
    temperature: 0.7,
    maxTokens: 1600,
  });
}

export async function generateSimilarQuestion({ topicName, conceptTag, misconception, difficulty }) {
  return jsonLLM({
    user: similarQuestionPrompt({ topicName, conceptTag, misconception, difficulty }),
    schema: generatedQuestionSchema,
    transform: coerceQuestionShape,
    temperature: 0.65,
    maxTokens: 1600,
  });
}

export async function gradeAttempt({ question, answerKey, rubric, answer, type }) {
  return jsonLLM({
    user: gradePrompt({ question, answerKey, rubric, answer, type }),
    schema: gradeSchema,
    temperature: 0.1,
    maxTokens: 700,
  });
}

export async function generateHint({ question, answerKey, rubric, answer, mistakeSummary, level, previousHints }) {
  return jsonLLM({
    user: hintPrompt({ question, answerKey, rubric, answer, mistakeSummary, level, previousHints }),
    schema: hintSchema,
    temperature: 0.5,
    maxTokens: 450,
  });
}

export async function solveSelfStudyQuestion({ question }) {
  return jsonLLM({
    user: selfStudySolvePrompt({ question }),
    schema: selfStudySolutionSchema,
    temperature: 0.2,
    maxTokens: 1800,
  });
}

export async function generateFlawedQuestion({ topicName, conceptTag, misconception, difficulty }) {
  return jsonLLM({
    user: flawedQuestionPrompt({ topicName, conceptTag, misconception, difficulty }),
    schema: flawedQuestionSchema,
    transform: coerceFlawShape,
    temperature: 0.7,
    maxTokens: 1800,
  });
}

export async function gradeFlawSelection({ question, steps, flawStep, flawExplanation, chosenStep, explanation }) {
  return jsonLLM({
    user: flawGradePrompt({ question, steps, flawStep, flawExplanation, chosenStep, explanation }),
    schema: flawGradeSchema,
    temperature: 0.1,
    maxTokens: 600,
  });
}

export async function generateLesson({ topicName, topicDescription, difficulty, resources = [] }) {
  return jsonLLM({
    user: lessonPrompt({ topicName, topicDescription, difficulty, resources }),
    schema: lessonSchema,
    temperature: 0.55,
    maxTokens: 1700,
  });
}
