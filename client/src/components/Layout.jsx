import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  Bookmark,
  LayoutGrid,
  PenLine,
  Star,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { cx } from '../lib/format.js';
import { Avatar } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Topics', icon: LayoutGrid, end: true },
  { to: '/self-study', label: 'Self-study', icon: PenLine },
  { to: '/mistakes', label: 'Mistakes', icon: Bookmark },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
];

function Brand() {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="Oopsie home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream shadow-[2px_2px_0_#ee552d] transition-transform group-hover:-rotate-3">
        <span className="font-display text-xl font-bold leading-none">!</span>
      </span>
      <span className="font-display text-2xl font-semibold tracking-tight text-ink">
        Oopsie<span className="text-coral-500">.</span>
      </span>
    </Link>
  );
}

export function Layout() {
  const { profile, user, signOut } = useAuth();
  const displayName = profile?.profile?.display_name || user?.email?.split('@')[0] || 'Learner';
  const points = profile?.profile?.total_points ?? 0;
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'rounded-full px-3.5 py-2 text-[0.82rem] font-semibold transition-colors',
                    isActive ? 'bg-ink text-cream' : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/stats"
              className="inline-flex items-center gap-1.5 rounded-full border border-sun-200 bg-sun-50 px-3 py-1.5 text-xs font-bold tabular-nums text-sun-700 transition hover:border-sun-500/40"
              title="Your total points"
            >
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {points}
            </Link>
            <Link to="/profile" aria-label="Your profile" className="rounded-full ring-offset-2 ring-offset-cream hover:ring-2 hover:ring-coral-200">
              <Avatar name={displayName} src={avatar} size="md" />
            </Link>
            <button
              onClick={signOut}
              className="hidden rounded-full px-3 py-1.5 text-xs font-semibold text-ink-mute transition hover:bg-ink/5 hover:text-ink sm:block"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[0.6rem] font-semibold transition-colors',
                  isActive ? 'text-coral-600' : 'text-ink-mute',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('grid h-7 w-10 place-items-center rounded-full transition-colors', isActive && 'bg-coral-100')}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span>{label === 'Self-study' ? 'Ask' : label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
