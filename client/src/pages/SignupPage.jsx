import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, User } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthShell } from '../components/AuthShell.jsx';
import { Button, ErrorBanner } from '../components/ui.jsx';
import { AuthDivider, friendlyAuthError, GoogleButton } from './LoginPage.jsx';

export function SignupPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (displayName.trim().length < 2) {
      setError('Pick a display name with at least 2 characters.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (authError) {
      setError(friendlyAuthError(authError.message));
      return;
    }

    if (data.session) {
      navigate('/', { replace: true });
      return;
    }

    setNotice('Check your inbox to confirm your email, then come back and sign in.');
  };

  return (
    <AuthShell>
      <div className="animate-fade-up">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">Start learning</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Get things wrong, on purpose.</h2>
        <p className="mt-2 text-sm leading-6 text-ink-mute">
          Free account. No age gate, no grade level — pick any topic and any difficulty.
        </p>

        <div className="mt-7">
          <GoogleButton label="Sign up with Google" />
          <AuthDivider />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="label">
                Display name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
                <input
                  id="displayName"
                  type="text"
                  autoComplete="nickname"
                  required
                  maxLength={40}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="How should the leaderboard know you?"
                  className="field pl-11"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="field"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="field"
              />
            </div>

            <ErrorBanner error={error} />

            {notice && (
              <div className="flex items-start gap-2 rounded-2xl border border-mint-200 bg-mint-50 px-4 py-3 text-sm text-mint-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {notice}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Create account <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-coral-600 underline decoration-coral-200 decoration-2 underline-offset-4 hover:text-coral-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
