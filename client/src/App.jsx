import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { isSupabaseConfigured } from './lib/supabase.js';
import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { buttonClasses, Card } from './components/ui.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { AuthCallbackPage } from './pages/AuthCallbackPage.jsx';
import { TopicsPage } from './pages/TopicsPage.jsx';
import { TopicPage } from './pages/TopicPage.jsx';
import { PracticePage } from './pages/PracticePage.jsx';
import { SelfStudyPage } from './pages/SelfStudyPage.jsx';
import { MistakesPage } from './pages/MistakesPage.jsx';
import { MistakeDetailPage } from './pages/MistakeDetailPage.jsx';
import { LeaderboardPage } from './pages/LeaderboardPage.jsx';
import { StatsPage } from './pages/StatsPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function ConfigNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="max-w-2xl p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-cream shadow-[2px_2px_0_#ee552d]">
            <span className="font-display text-xl font-bold">!</span>
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold">Almost there</h1>
            <p className="text-sm text-ink-mute">The client needs Supabase credentials.</p>
          </div>
        </div>

        <div className="space-y-4 text-sm leading-6 text-ink-soft">
          <p>
            Create <code className="rounded bg-ink/5 px-1.5 py-0.5">client/.env</code> from{' '}
            <code className="rounded bg-ink/5 px-1.5 py-0.5">client/.env.example</code> and set:
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs text-cream">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8787/api`}
          </pre>
          <p>
            Then restart <code className="rounded bg-ink/5 px-1.5 py-0.5">npm run dev</code>. The server also needs its own{' '}
            <code className="rounded bg-ink/5 px-1.5 py-0.5">server/.env</code>.
          </p>
          <p className="text-xs text-ink-mute">The full setup guide is in README.md.</p>
        </div>
      </Card>
    </div>
  );
}

function NotFoundPage() {
  const { session } = useAuth();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-semibold text-coral-500">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">This page took a wrong turn.</h1>
      <p className="mt-2 max-w-md text-sm text-ink-mute">
        Which is allowed here — we just prefer wrong answers to be useful. Head back and try again.
      </p>
      <Link to={session ? '/' : '/login'} className={buttonClasses({ className: 'mt-6' })}>
        {session ? 'Back to topics' : 'Go to sign in'}
      </Link>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigNotice />;

  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<TopicsPage />} />
          <Route path="topics/:slug" element={<TopicPage />} />
          <Route path="practice/:attemptId" element={<PracticePage />} />
          <Route path="self-study" element={<SelfStudyPage />} />
          <Route path="mistakes" element={<MistakesPage />} />
          <Route path="mistakes/:mistakeId" element={<MistakeDetailPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
