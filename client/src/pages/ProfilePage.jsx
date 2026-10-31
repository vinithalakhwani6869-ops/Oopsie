import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  LogOut,
  Mail,
  Save,
  Star,
  Trophy,
  UserRound,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Avatar,
  Badge,
  Button,
  buttonClasses,
  Card,
  ErrorBanner,
  Skeleton,
} from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

export function ProfilePage() {
  const { user, profile: contextProfile, refreshProfile, signOut } = useAuth();
  const [data, setData] = useState(contextProfile || null);
  const [loading, setLoading] = useState(!contextProfile);
  const [error, setError] = useState(null);
  const [name, setName] = useState(contextProfile?.profile?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api('/me')
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setName(payload.profile?.display_name || '');
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const saveName = async (event) => {
    event.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setSaveError('Use at least 2 characters.');
      return;
    }
    if (trimmed === data?.profile?.display_name) {
      setSaved(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const result = await api('/me', { method: 'PATCH', body: { display_name: trimmed } });
      setData((current) => ({ ...current, profile: result.profile }));
      setName(result.profile.display_name);
      setSaved(true);
      await refreshProfile();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44 w-full rounded-4xl" />
        <Skeleton className="h-64 w-full rounded-4xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorBanner error={error || 'Your profile could not load.'} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const profile = data.profile || {};
  const displayName = profile.display_name || user?.email?.split('@')[0] || 'Learner';
  const avatar = data.avatar_url || user?.user_metadata?.avatar_url;
  const provider = user?.app_metadata?.provider || 'email';
  const points = profile.total_points ?? 0;
  const rank = data.rank;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">
          <UserRound className="h-3.5 w-3.5" /> Profile
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your corner.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-mute">
          The name on the leaderboard, the account behind the mistakes, and the number that proves the streak.
        </p>
      </header>

      <Card className="overflow-hidden">
        <div className="dot-backdrop bg-ink px-5 py-6 text-cream sm:px-7">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={displayName} src={avatar} size="lg" className="ring-4 ring-cream/15" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-2xl font-semibold">{displayName}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-cream/60">
                <Mail className="h-3.5 w-3.5" /> {data.email || 'No email on file'}
              </p>
            </div>
            <Badge tone="outline" className="border-cream/20 text-cream/70">
              {provider === 'google' ? 'Google account' : 'Email account'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-ink/10 border-t border-ink/10">
          <div className="px-3 py-4 text-center">
            <p className="inline-flex items-center gap-1 font-display text-2xl font-semibold tabular-nums text-ink">
              <Star className="h-4 w-4 text-sun-500" /> {points}
            </p>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-ink-mute">Points</p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="inline-flex items-center gap-1 font-display text-2xl font-semibold tabular-nums text-ink">
              <Trophy className="h-4 w-4 text-coral-500" /> {rank ? `#${rank}` : '—'}
            </p>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-ink-mute">Global rank</p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="inline-flex items-center gap-1 font-display text-2xl font-semibold tabular-nums text-ink">
              <CalendarDays className="h-4 w-4 text-mint-600" />
              <span className="text-sm font-semibold">{profile.created_at ? formatDate(profile.created_at, { month: 'short', day: 'numeric' }) : '—'}</span>
            </p>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-ink-mute">Joined</p>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <BadgeCheck className="h-4 w-4 text-coral-500" /> Leaderboard name
          </h2>
          <span className="text-[0.68rem] text-ink-mute">{name.trim().length}/40</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-ink-mute">
          This is the only name other learners see. Your email and mistakes stay private.
        </p>

        <form onSubmit={saveName} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            id="display-name"
            value={name}
            maxLength={40}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            placeholder="How should we call you?"
            className="field sm:flex-1"
            aria-label="Display name"
            disabled={saving}
          />
          <Button type="submit" loading={saving} className="shrink-0">
            <Save className="h-4 w-4" /> Save name
          </Button>
        </form>

        {saved && !saveError && (
          <p className="mt-2 text-xs font-medium text-mint-700">Saved. The leaderboard will use this name.</p>
        )}
        <ErrorBanner error={saveError} className="mt-3" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">Explore your data</p>
          <p className="mt-1 flex-1 text-sm leading-6 text-ink-soft">
            Streaks, heatmap, accuracy, and the expandable mastery formula live on the stats page.
          </p>
          <Link to="/stats" className={buttonClasses({ variant: 'dark', className: 'mt-4 w-full' })}>
            Open stats <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card className="flex flex-col p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-mute">Session</p>
          <p className="mt-1 flex-1 text-sm leading-6 text-ink-soft">
            Signing out keeps your account, points, and mistakes. You can come back with Google or email.
          </p>
          <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </Card>
      </div>

      <p className="pb-2 text-center text-[0.68rem] leading-5 text-ink-mute">
        Points are earned with 0–3 hints, capped daily at midnight UTC. Self-study always pays 0.
      </p>
    </div>
  );
}
