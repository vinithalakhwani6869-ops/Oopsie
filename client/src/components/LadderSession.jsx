import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  ListChecks,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Markdown } from './Markdown.jsx';
import { DotLadder, HintLadderPanel } from './DotLadder.jsx';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  DifficultyBadge,
  ErrorBanner,
  ModeBadge,
  PointsBadge,
  Skeleton,
} from './ui.jsx';
import { cx, MODE_LABELS, relativeTime } from '../lib/format.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function backTarget(attempt) {
  if (!attempt) return { to: '/', label: 'Back to topics' };
  if (attempt.mode === 'self_study') return { to: '/self-study', label: 'Self-study' };
  if (attempt.mode === 'practice_similar' || attempt.mode === 'spot_flaw') {
    return { to: attempt.mistake_id ? `/mistakes/${attempt.mistake_id}` : '/mistakes', label: 'Back to mistake' };
  }
  return { to: '/', label: 'Back to topics' };
}

function SessionSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-36 w-full rounded-4xl" />
      <Skeleton className="h-28 w-full rounded-4xl" />
      <Skeleton className="h-64 w-full rounded-4xl" />
    </div>
  );
}

function AttemptHistory({ submissions, isFlaw }) {
  if (!submissions.length) return null;
  return (
    <details className="group rounded-3xl border border-ink/10 bg-white/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink-soft">
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-ink-mute" />
          Your attempts ({submissions.length})
        </span>
        <ChevronDown className="h-4 w-4 text-ink-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-ink/10 px-4 py-4">
        {submissions.map((entry, index) => (
          <div key={`${entry.at}-${index}`} className="rounded-2xl border border-ink/10 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-mute">Attempt {index + 1}</p>
              <Badge tone={entry.correct ? 'mint' : 'coral'}>{entry.correct ? 'Correct' : 'Not yet'}</Badge>
            </div>
            <p className="mt-2 text-sm font-medium leading-6 text-ink">
              {entry.answer}
              {isFlaw && entry.explanation && <span className="block font-normal text-ink-mute">“{entry.explanation}”</span>}
            </p>
            {!entry.correct && (entry.mistake_summary || entry.feedback) && (
              <p className="mt-1.5 text-xs leading-5 text-ink-mute">{entry.mistake_summary || entry.feedback}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function ResultPanel({ data, awardInfo, resolution, savedMistakeId, saveState }) {
  const { attempt, question } = data;
  const solved = attempt.status === 'solved';
  const isFlaw = attempt.mode === 'spot_flaw';
  const isSelfStudy = attempt.mode === 'self_study';
  const rawPoints = awardInfo?.raw ?? attempt.points;
  const awarded = awardInfo?.awarded ?? attempt.points;

  let pointsNote = null;
  if (isSelfStudy) {
    pointsNote = 'Self-study sessions never award points. The understanding is the prize.';
  } else if (solved && awardInfo?.reason === 'daily_cap') {
    pointsNote = `Daily cap reached: you earned ${awarded} of ${rawPoints} possible points. The cap resets at midnight UTC.`;
  } else if (solved && awardInfo?.reason === 'already_scored') {
    pointsNote = 'You already earned points for this question, so this repeat adds none.';
  } else if (solved && awarded === 0) {
    pointsNote =
      attempt.hints_used >= 3
        ? 'Three hints used — 0 points this round. The worked solution is yours to study.'
        : 'This solve added 0 points — the question was already scored, or the daily cap was reached.';
  } else if (solved) {
    pointsNote = `Worth ${awarded} point${awarded === 1 ? '' : 's'} with ${attempt.hints_used} hint${attempt.hints_used === 1 ? '' : 's'} used.`;
  }

  return (
    <div className="animate-fade-up space-y-4">
      <Card
        className={cx(
          'overflow-hidden p-0',
          solved ? 'border-mint-200' : 'border-sun-200',
        )}
      >
        <div className={cx('flex items-center justify-between gap-4 px-5 py-4 sm:px-6', solved ? 'bg-mint-50' : 'bg-sun-50')}>
          <div className="flex items-center gap-3">
            <span
              className={cx(
                'grid h-10 w-10 place-items-center rounded-full',
                solved ? 'bg-mint-500 text-white' : 'bg-sun-500 text-white',
              )}
            >
              {solved ? <Check className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
            </span>
            <div>
              <p className={cx('font-display text-lg font-semibold', solved ? 'text-mint-700' : 'text-sun-700')}>
                {solved ? 'Solved — on your own terms.' : 'Solution revealed.'}
              </p>
              <p className="text-xs text-ink-mute">
                {solved
                  ? 'You got there with the ladder doing its job.'
                  : 'Three hints are gone, so the full worked solution is now yours.'}
              </p>
            </div>
          </div>
          <span
            className={cx(
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums',
              solved ? 'bg-mint-600 text-white' : 'bg-white text-sun-700',
            )}
          >
            {solved ? `+${awarded}` : '0'} pts
          </span>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {pointsNote && <p className="rounded-2xl bg-ink/5 px-3.5 py-2.5 text-xs leading-5 text-ink-soft">{pointsNote}</p>}

          {isSelfStudy && (
            <p className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs leading-5 text-sky-700">
              <Bot className="mt-0.5 h-4 w-4 shrink-0" />
              AI-generated reference, verify independently. It is built from your pasted question and may miss context.
            </p>
          )}

          {attempt.mode === 'practice_similar' && resolution && (
            <p className="rounded-2xl border border-mint-200 bg-white px-3.5 py-2.5 text-xs leading-5 text-mint-700">
              Mistake progress: {resolution.qualifying}/{resolution.needed} qualifying solves.
              {resolution.resolved
                ? ' This mistake is now marked resolved.'
                : ' Solve twice with at most one hint to resolve it.'}
            </p>
          )}

          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">Final answer</p>
            <p className="mt-1.5 font-display text-xl font-semibold text-ink">{question.answer_key}</p>
          </div>

          {isFlaw && question.flaw && (
            <div className="rounded-2xl border border-coral-200 bg-coral-50 p-4">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-coral-700">
                The flaw was in step {question.flaw.flawed_step}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">{question.flaw.flaw_explanation}</p>
            </div>
          )}

          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">Worked solution</p>
            <div className="mt-2 rounded-2xl bg-white/70 p-4 ring-1 ring-ink/5">
              <Markdown>{question.solution}</Markdown>
            </div>
          </div>

          {question.rubric && (
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">What full credit needed</p>
              <p className="mt-1.5 text-sm leading-6 text-ink-mute">{question.rubric}</p>
            </div>
          )}
        </div>
      </Card>

      {savedMistakeId && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-mint-200 bg-mint-50 px-4 py-3 text-sm text-mint-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Saved to your Mistakes page.
          </span>
          <Link to={`/mistakes/${savedMistakeId}`} className="font-semibold underline underline-offset-4">
            Open
          </Link>
        </div>
      )}

      {saveState === 'saved' && !savedMistakeId && (
        <div className="flex items-center gap-2 rounded-2xl border border-mint-200 bg-mint-50 px-4 py-3 text-sm text-mint-700">
          <CheckCircle2 className="h-4 w-4" /> Saved to your Mistakes page.
        </div>
      )}
    </div>
  );
}

function SaveMistakePrompt({ onSave, onDismiss, state, error }) {
  return (
    <Card className="border-coral-200 bg-coral-50/60 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-coral-600 ring-1 ring-coral-200">
            <Bookmark className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">Save this mistake?</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-mute">
              We'll keep the concept and your misconception so you can train it with similar questions or Spot the Flaw.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={onDismiss} disabled={state === 'saving'}>
            <X className="h-4 w-4" /> Dismiss
          </Button>
          <Button onClick={onSave} loading={state === 'saving'}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
      {error && <ErrorBanner error={error} className="mt-3" />}
    </Card>
  );
}

export function LadderSession({ attemptId }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [answer, setAnswer] = useState('');
  const [selectedStep, setSelectedStep] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [awardInfo, setAwardInfo] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [saveDismissed, setSaveDismissed] = useState(false);
  const [savedMistakeId, setSavedMistakeId] = useState(null);
  const [nextLoading, setNextLoading] = useState(false);
  const [nextError, setNextError] = useState(null);

  const coachRef = useRef(null);
  const previousHintCount = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api(`/attempts/${attemptId}`)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  const hints = data?.hints || [];
  useEffect(() => {
    if (!data) return;
    if (previousHintCount.current === null) {
      previousHintCount.current = hints.length;
      return;
    }
    if (hints.length > previousHintCount.current) {
      coachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    previousHintCount.current = hints.length;
  }, [data, hints.length]);

  if (loading) return <SessionSkeleton />;

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorBanner error={error || 'Session not found.'} onRetry={() => window.location.reload()} />
        <Link to="/" className={buttonClasses({ variant: 'outline' })}>
          <ArrowLeft className="h-4 w-4" /> Back to topics
        </Link>
      </div>
    );
  }

  const { attempt, question, topic, submissions } = data;
  const inProgress = attempt.status === 'in_progress';
  const isFlaw = attempt.mode === 'spot_flaw';
  const back = backTarget(attempt);
  const latestHint = hints[hints.length - 1];
  const canSave = data.can_save_mistake && !saveDismissed && !data.mistake_saved;

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || !inProgress) return;

    if (isFlaw) {
      if (!selectedStep) {
        setSubmitError('Pick the step you think is wrong first.');
        return;
      }
      if (explanation.trim().length < 5) {
        setSubmitError('Add a sentence explaining why that step is wrong.');
        return;
      }
    } else if (!answer.trim()) {
      setSubmitError('Write an attempt before submitting. A guess is still an attempt.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = isFlaw
        ? await api(`/attempts/${attempt.id}/submit-flaw`, {
            method: 'POST',
            body: { step_index: selectedStep, explanation: explanation.trim() },
          })
        : await api(`/attempts/${attempt.id}/submit`, {
            method: 'POST',
            body: { answer: answer.trim() },
          });

      setData(payload);
      setAwardInfo(payload.award || null);
      setResolution(payload.resolution || null);
      setAnswer('');
      setSelectedStep(null);
      setExplanation('');
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const saveMistake = async () => {
    setSaveState('saving');
    setSaveError(null);
    try {
      const result = await api('/mistakes', { method: 'POST', body: { attempt_id: attempt.id } });
      setSavedMistakeId(result.mistake?.id || null);
      setSaveState('saved');
      setData((current) => ({ ...current, can_save_mistake: false, mistake_saved: true }));
    } catch (err) {
      if (err.status === 409) {
        setSaveState('saved');
        setData((current) => ({ ...current, can_save_mistake: false, mistake_saved: true }));
      } else {
        setSaveState('error');
        setSaveError(err);
      }
    }
  };

  const startNext = async () => {
    setNextLoading(true);
    setNextError(null);
    try {
      let payload = null;
      if (attempt.mode === 'practice') {
        payload = await api('/practice/start', {
          method: 'POST',
          body: { topic_id: question.topic_id, difficulty: question.difficulty },
        });
      } else if (attempt.mode === 'practice_similar' && attempt.mistake_id) {
        payload = await api(`/mistakes/${attempt.mistake_id}/practice`, { method: 'POST' });
      } else if (attempt.mode === 'spot_flaw' && attempt.mistake_id) {
        payload = await api(`/mistakes/${attempt.mistake_id}/spot-flaw`, { method: 'POST' });
      }

      if (payload?.attempt?.id) {
        navigate(`/practice/${payload.attempt.id}`);
      } else {
        navigate(attempt.mode === 'self_study' ? '/self-study' : back.to);
      }
    } catch (err) {
      setNextError(err);
    } finally {
      setNextLoading(false);
    }
  };

  const correctOption = !inProgress ? question.answer_key : null;
  const lastWrongAnswer = [...submissions].reverse().find((entry) => !entry.correct)?.answer;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={back.to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
        <div className="flex items-center gap-2">
          <DifficultyBadge difficulty={question.difficulty} />
          <ModeBadge mode={attempt.mode} />
          <PointsBadge points={data.potential_points} status={attempt.status} />
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">
              {topic?.name || (attempt.mode === 'self_study' ? 'Your own question' : 'Practice')}
            </p>
            <h1 className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">
              {attempt.status === 'solved' ? 'Session complete' : attempt.status === 'revealed' ? 'Solution unlocked' : 'Your move'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <DotLadder hintsUsed={attempt.hints_used} status={attempt.status} />
            <span className="hidden text-xs font-medium text-ink-mute sm:block">
              {attempt.hints_used}/3 hints
            </span>
          </div>
        </div>
        <HintLadderPanel hintsUsed={attempt.hints_used} status={attempt.status} />
      </Card>

      {attempt.mode === 'self_study' && (
        <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-700">
          <Bot className="mt-0.5 h-4 w-4 shrink-0" />
          Reference solution is AI-generated and hidden until the session ends. Verify independently.
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-ink/10 bg-white/50 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isFlaw ? 'sun' : 'outline'}>
              {isFlaw ? 'Spot the Flaw' : question.type === 'mcq' ? 'Multiple choice' : question.type === 'numeric' ? 'Numeric' : 'Short answer'}
            </Badge>
            {!inProgress && <Badge tone={attempt.status === 'solved' ? 'mint' : 'sun'}>{attempt.status === 'solved' ? 'Solved' : 'Revealed'}</Badge>}
          </div>
          <h2 className="mt-3 whitespace-pre-wrap font-display text-xl font-semibold leading-snug text-ink sm:text-2xl">
            {question.prompt}
          </h2>
          {isFlaw && (
            <p className="mt-2 text-sm leading-6 text-ink-mute">
              One step below contains a deliberate error. Pick it, then explain the flaw in your own words.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="px-5 py-5 sm:px-6">
          {isFlaw ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {(question.options || []).map((step, index) => {
                  const level = index + 1;
                  const isFlawed = !inProgress && question.flaw?.flawed_step === level;
                  const checked = selectedStep === level;
                  if (!inProgress) {
                    return (
                      <div
                        key={level}
                        className={cx(
                          'flex gap-3 rounded-2xl border p-3.5',
                          isFlawed ? 'border-coral-300 bg-coral-50' : 'border-ink/10 bg-white',
                        )}
                      >
                        <span
                          className={cx(
                            'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                            isFlawed ? 'bg-coral-500 text-white' : 'bg-ink/5 text-ink-mute',
                          )}
                        >
                          {level}
                        </span>
                        <p className="text-sm leading-6 text-ink-soft">{step}</p>
                      </div>
                    );
                  }
                  return (
                    <label
                      key={level}
                      className={cx(
                        'flex cursor-pointer gap-3 rounded-2xl border p-3.5 transition',
                        checked ? 'border-coral-400 bg-coral-50 ring-4 ring-coral-100' : 'border-ink/10 bg-white hover:border-ink/25',
                      )}
                    >
                      <input
                        type="radio"
                        name="flaw-step"
                        value={level}
                        checked={checked}
                        onChange={() => setSelectedStep(level)}
                        className="sr-only"
                        disabled={submitting}
                      />
                      <span
                        className={cx(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                          checked ? 'bg-coral-500 text-white' : 'bg-ink/5 text-ink-mute',
                        )}
                      >
                        {checked ? <Check className="h-3.5 w-3.5" /> : level}
                      </span>
                      <p className="text-sm leading-6 text-ink-soft">{step}</p>
                    </label>
                  );
                })}
              </div>

              {inProgress && (
                <div>
                  <label htmlFor="flaw-explanation" className="label">
                    Why is that step wrong?
                  </label>
                  <textarea
                    id="flaw-explanation"
                    rows={3}
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                    placeholder="Name the assumption or rule that breaks. 'It feels wrong' won't earn the point."
                    className="field resize-y"
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
          ) : question.type === 'mcq' ? (
            <div className="space-y-2">
              {(question.options || []).map((option, index) => {
                const isCorrect = correctOption && option === correctOption;
                const wasChosen = inProgress ? answer === option : lastWrongAnswer === option;
                return (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    disabled={!inProgress || submitting}
                    onClick={() => setAnswer(option)}
                    className={cx(
                      'flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition',
                      isCorrect
                        ? 'border-mint-300 bg-mint-50'
                        : wasChosen && !inProgress
                          ? 'border-coral-200 bg-coral-50/60'
                          : inProgress && answer === option
                            ? 'border-coral-400 bg-coral-50 ring-4 ring-coral-100'
                            : 'border-ink/10 bg-white hover:border-ink/25',
                      !inProgress && 'cursor-default',
                    )}
                  >
                    <span
                      className={cx(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                        isCorrect
                          ? 'bg-mint-500 text-white'
                          : answer === option && inProgress
                            ? 'bg-coral-500 text-white'
                            : 'bg-ink/5 text-ink-mute',
                      )}
                    >
                      {isCorrect ? <Check className="h-3.5 w-3.5" /> : LETTERS[index]}
                    </span>
                    <span className="text-sm leading-6 text-ink-soft">{option}</span>
                    {isCorrect && <span className="ml-auto shrink-0 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-mint-700">correct</span>}
                  </button>
                );
              })}
            </div>
          ) : question.type === 'numeric' ? (
            <div>
              <label htmlFor="answer" className="label">
                Your answer
              </label>
              <input
                id="answer"
                inputMode="decimal"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type the number…"
                className="field text-lg font-semibold tabular-nums"
                disabled={!inProgress || submitting}
                autoComplete="off"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="answer" className="label">
                Your attempt
              </label>
              <textarea
                id="answer"
                rows={4}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Talk me through your reasoning. A partial attempt is still a useful attempt."
                className="field resize-y"
                disabled={!inProgress || submitting}
              />
            </div>
          )}

          <ErrorBanner error={submitError} className="mt-4" />

          {inProgress && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-ink-mute">
                {attempt.hints_used < 3
                  ? `A wrong attempt unlocks hint ${attempt.hints_used + 1} — worth ${Math.max(0, 3 - attempt.hints_used - 1)} points after that.`
                  : 'All three hints are used. One more wrong attempt reveals the worked solution.'}
              </p>
              <Button type="submit" loading={submitting} size="lg" className="shrink-0">
                {isFlaw ? 'Check my answer' : 'Submit attempt'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </form>
      </Card>

      <div ref={coachRef} className="scroll-mt-24">
        {hints.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                <Lightbulb className="h-4 w-4 text-sun-500" /> Coach hints
              </h2>
              <span className="text-xs text-ink-mute">{hints.length} of 3</span>
            </div>
            {hints.map((hint) => (
              <div key={`${hint.level}-${hint.at}`} className="animate-fade-up rounded-3xl border border-sun-200 bg-sun-50 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-sun-500 text-[0.65rem] font-bold text-white">
                    {hint.level}
                  </span>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-sun-700">
                    {hint.level === 1 ? 'Conceptual nudge' : hint.level === 2 ? 'Where the slip is' : 'Nearly the next step'}
                  </p>
                  {hint === latestHint && inProgress && <Badge tone="sun" className="ml-auto">latest</Badge>}
                </div>
                <p className="mt-2.5 text-sm leading-6 text-ink-soft">{hint.content}</p>
              </div>
            ))}
            {!inProgress && <p className="text-xs text-ink-mute">The ladder is closed. Next time, try to solve it before the third hint.</p>}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-3xl border border-dashed border-ink/15 bg-white/40 px-4 py-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
            <div>
              <p className="text-sm font-semibold text-ink-soft">No hints yet — and that's the point.</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-mute">
                Submit an attempt first. The first hint is a conceptual nudge; it never contains the answer.
              </p>
            </div>
          </div>
        )}
      </div>

      <AttemptHistory submissions={submissions} isFlaw={isFlaw} />

      {inProgress && attempt.hints_used === 3 && (
        <div className="flex items-center gap-2 rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 text-xs font-medium text-coral-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Hint limit reached. The next wrong attempt reveals the full solution and ends this round at 0 points.
        </div>
      )}

      {!inProgress && (
        <ResultPanel
          data={data}
          awardInfo={awardInfo}
          resolution={resolution}
          savedMistakeId={savedMistakeId}
          saveState={saveState}
        />
      )}

      {canSave && (
        <SaveMistakePrompt
          onSave={saveMistake}
          onDismiss={() => setSaveDismissed(true)}
          state={saveState}
          error={saveError}
        />
      )}

      {nextError && <ErrorBanner error={nextError} onRetry={startNext} />}

      {!inProgress && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Link to={back.to} className={buttonClasses({ variant: 'outline' })}>
              <ArrowLeft className="h-4 w-4" /> {back.label}
            </Link>
            <Link to="/mistakes" className={buttonClasses({ variant: 'ghost' })}>
              <Bookmark className="h-4 w-4" /> Mistakes
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {attempt.mode === 'self_study' ? (
              <Link to="/self-study" className={buttonClasses({ variant: 'dark' })}>
                <RotateCcw className="h-4 w-4" /> Ask another question
              </Link>
            ) : (
              <Button onClick={startNext} loading={nextLoading} variant="dark">
                {attempt.mode === 'practice' ? 'Next question' : 'Train this mistake again'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      <p className="pb-2 text-center text-[0.68rem] text-ink-mute">
        {MODE_LABELS[attempt.mode]} · started {relativeTime(attempt.created_at)} · hints never contain the final answer
      </p>
    </div>
  );
}
