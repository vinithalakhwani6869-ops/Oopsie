import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, CheckCircle2, RefreshCw, Target } from 'lucide-react';
import { api } from '../lib/api.js';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  EmptyState,
  ErrorBanner,
  Skeleton,
} from '../components/ui.jsx';
import { cx, formatShortDate } from '../lib/format.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];

function CountCard({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-white/60',
    coral: 'bg-coral-50 border-coral-200',
    sun: 'bg-sun-50 border-sun-200',
    mint: 'bg-mint-50 border-mint-200',
  };
  return (
    <div className={cx('rounded-2xl border border-ink/10 px-4 py-3', tones[tone])}>
      <p className="font-display text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-ink-mute">{label}</p>
    </div>
  );
}

function MistakeCard({ mistake }) {
  const resolved = mistake.status === 'resolved';
  return (
    <Link
      to={`/mistakes/${mistake.id}`}
      className="group block rounded-3xl border border-ink/10 bg-paper p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-coral-200 hover:shadow-lift"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={resolved ? 'mint' : 'coral'}>{resolved ? 'Resolved' : 'Open'}</Badge>
        <Badge tone="outline">{mistake.topics?.name || 'Self-study'}</Badge>
        <span className="ml-auto text-[0.68rem] text-ink-mute">{formatShortDate(mistake.created_at)}</span>
      </div>

      <h2 className="mt-3 font-display text-lg font-semibold leading-snug text-ink group-hover:text-coral-700">
        {mistake.concept_tag}
      </h2>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-mute">{mistake.misconception}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3">
        <div className="flex items-center gap-3 text-[0.7rem] text-ink-mute">
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> {mistake.times_practiced || 0} practiced
          </span>
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3" /> {mistake.resolution?.qualifying || 0}/2 qualifying
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-coral-600">
          Train it <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function MistakesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api('/mistakes');
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

  const mistakes = data?.mistakes || [];
  const counts = data?.counts || { total: 0, open: 0, resolved: 0, practiced: 0 };
  const filtered = useMemo(
    () => (filter === 'all' ? mistakes : mistakes.filter((mistake) => mistake.status === filter)),
    [mistakes, filter],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">Your mistake bank</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Mistakes are the syllabus.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-mute">
            Every saved slip gets a concept and a misconception. Train the same blind spot with fresh questions until
            it stops being a blind spot.
          </p>
        </div>
        <Link to="/" className={buttonClasses({ variant: 'outline', className: 'shrink-0' })}>
          Browse topics <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountCard label="Saved" value={counts.total} />
        <CountCard label="Open" value={counts.open} tone="coral" />
        <CountCard label="Practiced" value={counts.practiced} tone="sun" />
        <CountCard label="Resolved" value={counts.resolved} tone="mint" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
              filter === item.id
                ? 'border-ink bg-ink text-cream'
                : 'border-ink/15 bg-white/50 text-ink-soft hover:border-ink/30 hover:bg-white',
            )}
          >
            {item.label}
            {item.id !== 'all' && (
              <span className="ml-1.5 text-[0.65rem] opacity-70">
                {item.id === 'open' ? counts.open : counts.resolved}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} onRetry={load} />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-4 h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </Card>
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((mistake) => (
            <MistakeCard key={mistake.id} mistake={mistake} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={mistakes.length ? CheckCircle2 : Bookmark}
            title={mistakes.length ? 'Nothing in this filter' : 'No saved mistakes yet'}
            description={
              mistakes.length
                ? 'Try another filter — the other pile is still there.'
                : 'When a session ends in a reveal, choose “Save this mistake”. It lands here with the concept and misconception attached.'
            }
            action={
              mistakes.length ? (
                <Button variant="outline" onClick={() => setFilter('all')}>
                  Show all
                </Button>
              ) : (
                <Link to="/" className={buttonClasses({ variant: 'dark' })}>
                  Practice something <ArrowRight className="h-4 w-4" />
                </Link>
              )
            }
          />
        </Card>
      )}
    </div>
  );
}
