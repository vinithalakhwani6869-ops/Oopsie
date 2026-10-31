import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Flame,
  ListChecks,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Heatmap } from '../components/Heatmap.jsx';
import { MasteryCard } from '../components/MasteryCard.jsx';
import {
  Badge,
  buttonClasses,
  Card,
  EmptyState,
  ErrorBanner,
  ProgressBar,
  Skeleton,
  Stat,
} from '../components/ui.jsx';

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-56" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-4xl" />
        ))}
      </div>
      <Skeleton className="h-52 w-full rounded-4xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-4xl" />
        <Skeleton className="h-48 w-full rounded-4xl" />
      </div>
    </div>
  );
}

export function StatsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api('/stats');
      setData(payload);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <StatsSkeleton />;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <ErrorBanner error={error || 'Stats could not load.'} onRetry={load} />
      </div>
    );
  }

  const { summary, mistakes, heatmap, mastery } = data;
  const capProgress = summary.daily_cap ? (summary.today_points / summary.daily_cap) * 100 : 0;
  const capReached = summary.today_points >= summary.daily_cap;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">
            <BarChart3 className="h-3.5 w-3.5" /> Your progress
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Receipts, not vibes.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-mute">
            Points, accuracy, streaks, and a per-topic mastery score you can actually interrogate. Every number here
            comes from your own sessions.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to="/leaderboard" className={buttonClasses({ variant: 'outline' })}>
            <Trophy className="h-4 w-4" /> Leaderboard
          </Link>
          <Link to="/" className={buttonClasses({ variant: 'dark' })}>
            Practice <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Summary">
        <Stat label="Total points" value={summary.total_points} icon={Star} />
        <Stat label="Accuracy" value={`${summary.accuracy}%`} icon={Target} hint={`${summary.total_solved} solved`} />
        <Stat label="Current streak" value={`${summary.current_streak}d`} icon={Flame} hint={`best ${summary.longest_streak}d`} />
        <Stat label="Today" value={summary.today_points} icon={CalendarDays} hint={`of ${summary.daily_cap} cap`} />
        <Stat label="Attempts" value={summary.total_attempts} icon={ListChecks} hint={`${summary.total_revealed} revealed`} />
        <Stat label="Mistakes open" value={mistakes.open} icon={Bookmark} hint={`${mistakes.resolved} resolved`} />
      </section>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">Daily point cap</p>
            <p className="mt-1 text-sm text-ink-soft">
              {capReached
                ? 'Cap reached for today. Practice still counts toward streaks and mastery — it just pays 0 until midnight UTC.'
                : `${summary.daily_cap - summary.today_points} point${summary.daily_cap - summary.today_points === 1 ? '' : 's'} left in today's practice allowance.`}
            </p>
          </div>
          <Badge tone={capReached ? 'sun' : 'mint'}>
            {summary.today_points}/{summary.daily_cap}
          </Badge>
        </div>
        <ProgressBar value={capProgress} tone={capReached ? 'sun' : 'mint'} className="mt-3" />
      </Card>

      <Heatmap cells={heatmap} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Topic mastery</h2>
            <p className="mt-1 text-sm leading-6 text-ink-mute">
              Recency-weighted performance per topic, using your last 10 scored attempts. Open “Why this score?” to see
              every input.
            </p>
          </div>
          <Badge tone="outline">{mastery.length} topic{mastery.length === 1 ? '' : 's'} attempted</Badge>
        </div>

        {mastery.length ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {mastery.map((row) => (
              <MasteryCard key={row.topic?.id || row.topic?.name} row={row} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={CheckCircle2}
              title="No scored attempts yet"
              description="Mastery starts after your first finished practice session. Self-study sessions stay out of the calculation."
              action={
                <Link to="/" className={buttonClasses({ variant: 'dark' })}>
                  Choose a topic <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          </Card>
        )}
      </section>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-coral-100 text-coral-700">
            <Bookmark className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">Mistake bank</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-mute">
              {mistakes.saved} saved · {mistakes.practiced} trained · {mistakes.open} open · {mistakes.resolved} resolved
            </p>
          </div>
        </div>
        <Link to="/mistakes" className={buttonClasses({ variant: 'outline', className: 'shrink-0' })}>
          Open mistakes <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>
    </div>
  );
}
