import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button, ErrorBanner } from '../components/ui.jsx';

export function friendlyAuthError(message = '') {
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect. Try again.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first — check your inbox for the link.';
  if (/already registered|already exists/i.test(message)) return 'That email already has an account. Sign in instead.';
  if (/password should be at least/i.test(message)) return 'Use a password with at least 8 characters.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return message || 'Something went wrong. Please try again.';
}

export function GoogleButton({ label = 'Continue with Google' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (oauthError) {
      setError(friendlyAuthError(oauthError.message));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" size="lg" className="w-full bg-white" onClick={handleGoogle} loading={loading}>
        {!loading && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.05-3.72 1.05-2.86 0-5.28-1.93-6.15-4.52H2.18v2.85A11 11 0 0 0 12 23Z"
            />
            <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.04H2.18a11 11 0 0 0 0 9.92l3.67-2.85Z" />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.67 2.85C6.72 7.3 9.14 5.38 12 5.38Z"
            />
          </svg>
        )}
        {label}
      </Button>
      <ErrorBanner error={error} />
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">
      <span className="h-px flex-1 bg-ink/10" />
      or use email
      <span className="h-px flex-1 bg-ink/10" />
    </div>
  );
}

export function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    const from = location.state?.from || '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) {
      setError(friendlyAuthError(authError.message));
      return;
    }
    navigate(location.state?.from || '/', { replace: true });
  };

  return (
    <AuthShell>
      <div className="animate-fade-up">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">Welcome back</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Pick up where you left off.</h2>
        <p className="mt-2 text-sm leading-6 text-ink-mute">
          Your hints, mistakes, and streak are waiting. The leaderboard is not going to climb itself.
        </p>

        <div className="mt-7">
          <GoogleButton />
          <AuthDivider />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="field pl-11"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="field"
              />
            </div>

            <ErrorBanner error={error} />

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            New to Oopsie?{' '}
            <Link to="/signup" className="font-semibold text-coral-600 underline decoration-coral-200 decoration-2 underline-offset-4 hover:text-coral-700">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
