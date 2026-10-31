import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Crown,
  Flame,
  Info,
  Medal,
  RefreshCw,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Badge, Button, buttonClasses, Card, ErrorBanner, Skeleton, Spinner } from '../components/ui.jsx';
import { cx, initials } from '../lib/format.js';

function LeaderboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-44 w-full rounded-4xl" />
        <Skeleton className="h-52 w-full rounded-4xl" />
        <Skeleton className="h-44 w-full rounded-4xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-4xl" />
    </div>
  );
}

function PodiumCard({ entry, place }) {
  const config = {
    1: {
      ring: 'border-sun-500 bg-sun-50 sm:order-2 sm:-mt-4',
      chip: 'bg-sun-500 text-white',
      icon: Crown,
      label: 'First',
    },
    2: {
      ring: 'border-ink/15 bg-white sm:order-1',
      chip: 'bg-ink/10 text-ink-soft',
      icon: Medal,
      label: 'Second',
    },
    3: {
      ring: 'border-coral-200 bg-coral-50/60 sm:order-3',
      chip: 'bg-coral-200 text-coral-700',
      icon: Medal,
      label: 'Third',
    },
  }[place];

  const Icon = config.icon;

  return (
    <Card
      className={cx(
        'relative flex flex-col items-center gap-2 p-5 text-center',
        config.ring,
        entry?.is_me && 'ring-2 ring-coral-400 ring-offset-2 ring-offset-cream',
      )}
    >
      <span className={cx('absolute -top-3 left-4 rounded-full px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em]', config.chip)}>
        {place === 1 ? 'Top spot' : `#${place}`}
      </span>
      <span
        className={cx(
          'mt-2 grid h-14 w-14 place-items-center rounded-full',
          place === 1 ? 'bg-sun-500 text-white' : 'bg-ink text-cream',
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-semibold text-ink">{entry?.display_name || '—'}</p>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-ink-mute">
          {entry?.is_me ? 'You' : 'Learner'}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sun-200 bg-white px-3 py-1 text-sm font-bold tabular-nums text-sun-700">
        <Star className="h-3.5 w-3.5 fill-current" /> {entry?.points ?? 0}
      </span>
      <span className="text-[0.62rem] text-ink-mute">{config.label} place</span>
    </Card>
  );
}

function RankRow({ entry }) {
  return (
    <li
      className={cx(
        'flex items-center gap-3 px-4 py-3 sm:px-5',
        entry.is_me ? 'bg-coral-50/70' : 'odd:bg-white/45',
      )}
    >
      <span
        className={cx(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums',
          entry.rank <= 3 ? 'bg-ink text-cream' : 'bg-ink/5 text-ink-mute',
        )}
      >
        {entry.rank}
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral-100 text-[0.65rem] font-bold text-coral-700">
        {initials(entry.display_name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
        {entry.display_name}
        {entry.is_me && <Badge tone="coral" className="ml-2 align-middle">you</Badge>}
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-ink">
        <Star className="h-3.5 w-3.5 text-sun-500" /> {entry.points}
      </span>
    </li>
  );
}

export function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const payload = await api('/leaderboard');
      setData(payload);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LeaderboardSkeleton />;

  const entries = data?.entries || [];
  const me = data?.me || null;
  const dailyCap = data?.daily_cap || 30;
  const totalPlayers = data?.total_players ?? entries.length;
  const top = entries.slice(0, 3);
  const rest = entries.slice(3, 100);
  const meInList = me ? entries.some((entry) => entry.is_me) : false;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Points for restraint.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-mute">
            Fewer hints, more points. Every solve is worth up to 3, and the daily cap keeps the race about consistency
            rather than marathons.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink-soft">
            <Users className="h-3.5 w-3.5" /> {totalPlayers} player{totalPlayers === 1 ? '' : 's'}
          </span>
          <Button variant="outline" size="sm" onClick={() => load({ quiet: true })} disabled={refreshing}>
            {refreshing ? <Spinner className="h-3.5 w-3.5" label="Refreshing" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </header>

      <ErrorBanner error={error} onRetry={() => load()} />

      {me && (
        <Card className="flex flex-wrap items-center gap-4 border-coral-200 bg-coral-50/60 p-4 sm:p-5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-cream">
            <Star className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-coral-700">Your standing</p>
            <p className="font-display text-xl font-semibold text-ink">
              Rank #{me.rank} <span className="text-sm font-normal text-ink-mute">of {totalPlayers}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold tabular-nums text-ink">{me.points}</p>
            <p className="text-[0.65rem] uppercase tracking-[0.1em] text-ink-mute">points</p>
          </div>
          <Link to="/stats" className={buttonClasses({ variant: 'outline', size: 'sm', className: 'bg-white' })}>
            See your stats <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      )}

      {entries.length ? (
        <>
          {top.length > 0 && (
            <section className="grid gap-3 pt-2 sm:grid-cols-3" aria-label="Top three">
              {[1, 2, 3].map((place) => {
                const entry = top[place - 1];
                if (!entry) return <div key={place} className="hidden sm:block" />;
                return <PodiumCard key={place} entry={entry} place={place} />;
              })}
            </section>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3.5 sm:px-5">
              <h2 className="font-display text-lg font-semibold text-ink">The rest of the ladder</h2>
              <span className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-mute">Top 100</span>
            </div>

            {rest.length ? (
              <ol className="divide-y divide-ink/5">
                {rest.map((entry) => (
                  <RankRow key={`${entry.rank}-${entry.display_name}`} entry={entry} />
                ))}
              </ol>
            ) : (
              <p className="px-5 py-6 text-sm text-ink-mute">Only the podium so far. One solve could rearrange it.</p>
            )}

            {me && !meInList && (
              <div className="border-t-2 border-dashed border-coral-200 bg-coral-50/50">
                <p className="px-5 pt-3 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-coral-700">
                  Your row
                </p>
                <ol>
                  <RankRow entry={me} />
                </ol>
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-sun-50 text-sun-700">
              <Trophy className="h-6 w-6" />
            </span>
            <h2 className="font-display text-xl font-semibold text-ink">No scores on the board yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-ink-mute">
              Be the first name up here. Solve one question without a hint and the board starts with you.
            </p>
            <Link to="/" className={buttonClasses({ className: 'mt-5' })}>
              Pick a topic <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">
            <Flame className="h-3.5 w-3.5 text-coral-500" /> Daily point cap
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{dailyCap} points / day</p>
          <p className="mt-1 text-xs leading-5 text-ink-mute">
            Practice, similar practice, and Spot the Flaw all share the cap. It resets at midnight UTC. Self-study is
            always 0 points — you supply the question.
          </p>
        </Card>

        <Card className="p-5">
          <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">
            <Info className="h-3.5 w-3.5 text-sky-600" /> How points are earned
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { hints: '0', points: 3 },
              { hints: '1', points: 2 },
              { hints: '2', points: 1 },
              { hints: '3', points: 0 },
            ].map((item) => (
              <div key={item.hints} className="rounded-xl border border-ink/10 bg-white/60 px-2 py-2 text-center">
                <p className="font-display text-lg font-semibold tabular-nums text-ink">{item.points}</p>
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-ink-mute">
                  {item.hints} hint{item.hints === '1' ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
