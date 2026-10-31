import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  History,
  Lightbulb,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { api } from '../lib/api.js';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  DifficultyBadge,
  EmptyState,
  ErrorBanner,
  ModeBadge,
  ProgressBar,
  Skeleton,
} from '../components/ui.jsx';
import { cx, relativeTime } from '../lib/format.js';

const STATUS_LABELS = {
  solved: 'Solved',
  revealed: 'Revealed',
  in_progress: 'In progress',
};

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-64 w-full rounded-4xl" />
      <Skeleton className="h-40 w-full rounded-4xl" />
      <Skeleton className="h-28 w-full rounded-4xl" />
    </div>
  );
}

function StartButton({ label, icon: Icon, onClick, loading, variant = 'dark' }) {
  return (
    <Button variant={variant} onClick={onClick} loading={loading} className="w-full">
      <Icon className="h-4 w-4" /> {label}
    </Button>
  );
}

export function MistakeDetailPage() {
  const { mistakeId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api(`/mistakes/${mistakeId}`);
      setData(payload);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistakeId]);

  const startTraining = async (kind) => {
    setAction(kind);
    setActionError(null);
    try {
      const payload = await api(`/mistakes/${mistakeId}/${kind}`, { method: 'POST' });
      if (payload?.attempt?.id) navigate(`/practice/${payload.attempt.id}`);
    } catch (err) {
      setActionError(err);
    } finally {
      setAction(null);
    }
  };

  const toggleStatus = async () => {
    const mistake = data?.mistake;
    if (!mistake) return;
    setStatusSaving(true);
    setActionError(null);
    try {
      const result = await api(`/mistakes/${mistakeId}`, {
        method: 'PATCH',
        body: { status: mistake.status === 'resolved' ? 'open' : 'resolved' },
      });
      setData((current) => ({
        ...current,
        mistake: {
          ...current.mistake,
          ...result.mistake,
          resolution: { ...current.mistake.resolution, complete: result.mistake.status === 'resolved' },
        },
      }));
    } catch (err) {
      setActionError(err);
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !data?.mistake) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorBanner error={error || 'Mistake not found.'} onRetry={load} />
        <Link to="/mistakes" className={buttonClasses({ variant: 'outline' })}>
          <ArrowLeft className="h-4 w-4" /> Back to mistakes
        </Link>
      </div>
    );
  }

  const mistake = data.mistake;
  const resolved = mistake.status === 'resolved';
  const qualifying = mistake.resolution?.qualifying || 0;
  const needed = mistake.resolution?.needed || 2;
  const progress = Math.min(100, (qualifying / needed) * 100);
  const attempts = mistake.recent_attempts || [];
  const topic = mistake.topics;
  const difficulty = mistake.questions?.difficulty;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        to="/mistakes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All mistakes
      </Link>

      <Card className="overflow-hidden">
        <div className={cx('px-5 py-5 sm:px-7 sm:py-6', resolved ? 'bg-mint-50' : 'bg-coral-50/60')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={resolved ? 'mint' : 'coral'}>{resolved ? 'Resolved' : 'Open'}</Badge>
            {topic ? (
              topic.slug ? (
                <Link to={`/topics/${topic.slug}`}>
                  <Badge tone="outline">{topic.name}</Badge>
                </Link>
              ) : (
                <Badge tone="outline">{topic.name}</Badge>
              )
            ) : (
              <Badge tone="outline">Self-study</Badge>
            )}
            {difficulty && <DifficultyBadge difficulty={difficulty} />}
          </div>

          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {mistake.concept_tag}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{mistake.misconception}</p>

          <p className="mt-3 text-[0.68rem] text-ink-mute">Saved {relativeTime(mistake.created_at)}</p>
        </div>

        <div className="grid gap-5 border-t border-ink/10 p-5 sm:grid-cols-2 sm:p-7">
          <div>
            <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">
              <AlertTriangle className="h-3.5 w-3.5 text-coral-500" /> What went wrong
            </p>
            <p className="mt-2 rounded-2xl border border-ink/10 bg-white/60 p-3.5 text-sm leading-6 text-ink-soft">
              {mistake.user_attempt ? (
                <span className="whitespace-pre-wrap">{mistake.user_attempt}</span>
              ) : (
                <span className="text-ink-mute">No attempt text was captured for this one.</span>
              )}
            </p>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">
              <BookOpen className="h-3.5 w-3.5 text-sky-600" /> Original question
            </p>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-ink/10 bg-white/60 p-3.5 text-sm leading-6 text-ink-soft">
              {mistake.questions?.prompt || 'The original prompt is no longer available.'}
            </p>
          </div>
        </div>
      </Card>

      <Card className={cx('p-5 sm:p-6', resolved ? 'border-mint-200' : '')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">
              <TargetIcon /> Resolution progress
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {resolved
                ? 'This mistake is resolved. Keep training it if you want the pattern to stick.'
                : `Solve ${needed} similar questions with 1 hint or fewer to close this loop.`}
            </p>
          </div>
          <span className="font-display text-3xl font-semibold tabular-nums text-ink">
            {Math.min(qualifying, needed)}/{needed}
          </span>
        </div>

        <ProgressBar value={progress} tone={resolved ? 'mint' : 'coral'} className="mt-4" />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <span className="text-xs text-ink-mute">
            {qualifying >= needed
              ? 'Qualifying solves reached.'
              : `Practice-similar solves count only at 0–1 hints. Spot the Flaw is unscored but sharpens the diagnosis.`}
          </span>
          <Button variant="ghost" size="sm" onClick={toggleStatus} loading={statusSaving}>
            {resolved ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" /> Reopen
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
              </>
            )}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col p-5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-coral-100 text-coral-700">
            <RefreshCw className="h-5 w-5" />
          </span>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Practice similar</h2>
          <p className="mt-1 flex-1 text-sm leading-6 text-ink-mute">
            A fresh question on the same concept, at the same difficulty. Solve it with 0–1 hints to count toward
            resolution.
          </p>
          <div className="mt-4">
            <StartButton
              label={action === 'practice' ? 'Building a question…' : 'Train this blind spot'}
              icon={Wand2}
              loading={action === 'practice'}
              onClick={() => startTraining('practice')}
            />
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sun-100 text-sun-700">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Spot the Flaw</h2>
          <p className="mt-1 flex-1 text-sm leading-6 text-ink-mute">
            Read a worked argument with one deliberate error, find the broken step, and explain why it fails. Unscored,
            all diagnosis.
          </p>
          <div className="mt-4">
            <StartButton
              label={action === 'spot-flaw' ? 'Writing the flawed argument…' : 'Find the fake step'}
              icon={Lightbulb}
              variant="outline"
              loading={action === 'spot-flaw'}
              onClick={() => startTraining('spot-flaw')}
            />
          </div>
        </Card>
      </div>

      <ErrorBanner error={actionError} />

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <History className="h-4 w-4 text-ink-mute" /> Recent training
          </h2>
          <span className="text-xs text-ink-mute">{attempts.length} session{attempts.length === 1 ? '' : 's'}</span>
        </div>

        {attempts.length ? (
          <ul className="mt-4 space-y-2">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <Link
                  to={`/practice/${attempt.id}`}
                  className="group flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white/60 px-4 py-3 transition hover:border-coral-200 hover:bg-white"
                >
                  <ModeBadge mode={attempt.mode} />
                  <span className="text-xs font-medium text-ink-soft">
                    {attempt.status === 'solved' ? (
                      <span className="text-mint-700">Solved</span>
                    ) : attempt.status === 'revealed' ? (
                      <span className="text-sun-700">Revealed</span>
                    ) : (
                      <span className="text-ink-mute">In progress</span>
                    )}
                  </span>
                  <span className="text-xs text-ink-mute">
                    {attempt.hints_used} hint{attempt.hints_used === 1 ? '' : 's'} · {attempt.points || 0} pts
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-[0.68rem] text-ink-mute">
                    {relativeTime(attempt.created_at)}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={History}
            title="No training sessions yet"
            description="Start with Practice similar — the first two qualifying solves are what close this loop."
            className="py-8"
          />
        )}
      </Card>

      <p className="pb-2 text-center text-[0.68rem] leading-5 text-ink-mute">
        AI-generated questions are checked against the concept you missed. Verify anything that looks off.
      </p>
    </div>
  );
}

function TargetIcon() {
  return (
    <span className="grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-current" aria-hidden="true">
      <span className="h-1 w-1 rounded-full bg-current" />
    </span>
  );
}
