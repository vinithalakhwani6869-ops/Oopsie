import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Flame,
  Search,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TopicIcon } from '../components/TopicIcon.jsx';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  EmptyState,
  ErrorBanner,
  Skeleton,
  Stat,
} from '../components/ui.jsx';
import { cx } from '../lib/format.js';

const FILTERS = [
  { id: 'all', label: 'All topics' },
  { id: 'technical', label: 'Technical' },
  { id: 'non-technical', label: 'Everyday' },
];

function TopicCard({ topic }) {
  return (
    <Link
      to={`/topics/${topic.slug}`}
      className="group relative flex h-full flex-col rounded-4xl border border-ink/10 bg-paper p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-coral-200 hover:shadow-lift sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <TopicIcon icon={topic.icon} category={topic.category} size="lg" />
        <ArrowUpRight className="h-5 w-5 text-ink-mute transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral-500" aria-hidden="true" />
      </div>
      <div className="mt-5 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={topic.category === 'technical' ? 'coral' : 'mint'}>
            {topic.category === 'technical' ? 'Technical' : 'Everyday'}
          </Badge>
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-mute">
            {topic.question_count || 0} questions
          </span>
        </div>
        <h3 className="mt-3 font-display text-[1.35rem] font-semibold leading-tight text-ink">{topic.name}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-mute">{topic.description}</p>
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-coral-600">
        Open topic <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Hero({ name, stats }) {
  return (
    <section className="relative overflow-hidden rounded-4xl bg-ink text-cream shadow-card">
      <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-coral-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-mint-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 dot-backdrop opacity-[0.05]" />

      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.35fr_0.65fr] lg:p-11">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-cream/70">
            <Sparkles className="h-3 w-3 text-coral-400" />
            Any topic · any level · answers last
          </p>
          <h1 className="mt-5 max-w-xl font-display text-[2.4rem] font-semibold leading-[1.02] tracking-tight sm:text-5xl">
            Learn by getting it{' '}
            <span className="italic text-coral-400">wrong</span> first.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-cream/65 sm:text-[0.95rem]">
            {name ? `${name.split(' ')[0]}, ` : ''}every question starts with your attempt. Three hints, never the
            answer. Only then does the worked solution appear — and the mistake becomes something you can train.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#topics" className={buttonClasses({ size: 'lg' })}>
              Pick a topic <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/self-study"
              className={buttonClasses({ variant: 'outline', size: 'lg', className: 'border-white/20 bg-white/5 text-cream hover:border-white/35 hover:bg-white/10' })}
            >
              <BookOpen className="h-4 w-4" /> Ask your own question
            </Link>
          </div>
        </div>

        <div className="hidden items-center lg:flex">
          <div className="w-full rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-cream/50">The hint ladder</p>
            <div className="mt-4 flex items-center gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <span className={cx('grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold', n === 1 ? 'border-sun-500 bg-sun-500 text-ink' : 'border-white/20 text-cream/60')}>
                    {n}
                  </span>
                  {n < 3 && <span className={cx('h-[2px] w-5 rounded-full', n === 1 ? 'bg-sun-400' : 'bg-white/15')} />}
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2.5">
              {[
                ['Nudge', 'Names the right area.'],
                ['Slip', 'Where your reasoning broke.'],
                ['Almost', 'The next move, not the answer.'],
              ].map(([title, copy], index) => (
                <div key={title} className={cx('flex items-center gap-3 rounded-xl px-3 py-2', index === 0 && 'bg-white/10')}>
                  <span className={cx('h-2 w-2 rounded-full', index === 0 ? 'bg-sun-400' : 'bg-white/25')} />
                  <div>
                    <p className="text-xs font-semibold text-cream">{title}</p>
                    <p className="text-[0.68rem] text-cream/50">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-white/10 pt-4 text-[0.68rem] leading-5 text-cream/45">
              Got it on your own? 3 points. One hint? 2. Two? 1. Three? The solution is your reward — and 0 points.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TopicsPage() {
  const { profile } = useAuth();
  const [topics, setTopics] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [topicsData, statsData] = await Promise.all([api('/topics'), api('/stats')]);
      setTopics(topicsData.topics || []);
      setStats(statsData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((topic) => {
      const matchesFilter = filter === 'all' || topic.category === filter;
      const matchesQuery = !q || topic.name.toLowerCase().includes(q) || topic.description.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [topics, filter, query]);

  const summary = stats?.summary;
  const displayName = profile?.profile?.display_name || '';

  return (
    <div className="space-y-8">
      <Hero name={displayName} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your progress">
        <Stat label="Total points" value={summary?.total_points ?? 0} icon={Star} hint={`Daily cap ${stats?.summary?.daily_cap ?? 30}`} />
        <Stat label="Current streak" value={`${summary?.current_streak ?? 0} d`} icon={Flame} hint={`Longest ${summary?.longest_streak ?? 0} days`} />
        <Stat label="Solved" value={summary?.total_solved ?? 0} icon={Target} hint={`${summary?.accuracy ?? 0}% accuracy`} />
        <Stat label="Today" value={`${summary?.today_points ?? 0}/${summary?.daily_cap ?? 30}`} icon={Sparkles} hint="Practice points earned" />
      </section>

      <section id="topics" className="scroll-mt-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">Curriculum</p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">Choose a topic</h2>
            <p className="mt-1 text-sm text-ink-mute">Twelve starting points. Difficulty is yours to choose.</p>
          </div>

          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search topics</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics…"
              className="field h-11 py-0 pl-10 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
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
            </button>
          ))}
        </div>

        {error && <ErrorBanner error={error} onRetry={load} className="mt-5" />}

        <div className="mt-5">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card p-5">
                  <Skeleton className="h-16 w-16 rounded-3xl" />
                  <Skeleton className="mt-5 h-4 w-24" />
                  <Skeleton className="mt-3 h-6 w-4/5" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={Search}
                title="No topics match that"
                description="Try a different search or switch the filter back to all topics."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
