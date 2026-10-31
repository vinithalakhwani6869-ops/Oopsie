import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { friendlyAuthError } from '../lib/authErrors.js';
import { Button, Card, Spinner } from '../components/ui.jsx';

const CALLBACK_TIMEOUT_MS = 15000;

function readCallbackParams() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const get = (key) => query.get(key) || hash.get(key);
  return {
    code: get('code'),
    hasTokens: Boolean(get('access_token') && get('refresh_token')),
    errorDescription: get('error_description') || get('error') || null,
    errorCode: get('error_code') || null,
  };
}

export function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const exchangeStarted = useRef(false);
  const paramsRef = useRef(null);
  if (!paramsRef.current) paramsRef.current = readCallbackParams();

  // Surface errors that Google/Supabase put on the callback URL. Without this
  // the page would sit on a spinner and then show a generic "no session".
  useEffect(() => {
    const { errorDescription, errorCode } = paramsRef.current;
    if (errorDescription || errorCode) {
      setError(friendlyAuthError(errorDescription || '', { code: errorCode }));
    }
  }, []);

  useEffect(() => {
    if (error) return undefined;

    if (session) {
      navigate('/', { replace: true });
      return undefined;
    }

    if (loading) return undefined;

    const { code, hasTokens } = paramsRef.current;

    // supabase-js normally exchanges the PKCE code during initialization. If
    // that failed it leaves the code on the URL, so retry explicitly to get a
    // real error message instead of a silent timeout.
    if (code && supabase && !exchangeStarted.current) {
      exchangeStarted.current = true;
      supabase.auth
        .exchangeCodeForSession(code)
        .then(async ({ error: exchangeError }) => {
          if (!exchangeError) {
            navigate('/', { replace: true });
            return;
          }

          // The auto-exchange may have won the race. Only report an error if
          // there really is no session.
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            navigate('/', { replace: true });
            return;
          }

          setError(friendlyAuthError(exchangeError.message));
        })
        .catch((err) => setError(friendlyAuthError(err?.message)));
      return undefined;
    }

    // A direct visit (or an implicit hash that was already consumed) has
    // nothing to wait for; don't leave the learner staring at a spinner.
    const delay = code || hasTokens ? CALLBACK_TIMEOUT_MS : 1500;
    const timer = setTimeout(() => setTimedOut(true), delay);
    return () => clearTimeout(timer);
  }, [error, session, loading, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-coral-100 text-xl font-bold text-coral-700">!</span>
          <h1 className="mt-4 font-display text-2xl font-semibold">Sign-in didn't finish</h1>
          <p className="mt-2 text-sm leading-6 text-ink-mute">{error}</p>
          <p className="mt-4 text-xs leading-5 text-ink-mute">
            Run <code className="rounded bg-ink/5 px-1.5 py-0.5">npm run check</code> to validate both env files and the
            Google provider.
          </p>
          <Link to="/login" className="mt-6 inline-flex">
            <Button>Try again</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">No session found</h1>
          <p className="mt-2 text-sm leading-6 text-ink-mute">
            The sign-in link may have expired, or the browser came back to a different address than it started from.
            Use the same origin consistently (<code className="rounded bg-ink/5 px-1 py-0.5">localhost</code> vs{' '}
            <code className="rounded bg-ink/5 px-1 py-0.5">127.0.0.1</code>), and make sure{' '}
            <code className="rounded bg-ink/5 px-1 py-0.5">{window.location.origin}/auth/callback</code> is listed in
            Supabase → Authentication → URL Configuration.
          </p>
          <Link to="/login" className="mt-6 inline-flex">
            <Button>Try again</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-cream shadow-[3px_3px_0_#ee552d]">
        <span className="font-display text-2xl font-bold">!</span>
      </span>
      <Spinner className="h-5 w-5" />
      <p className="text-sm text-ink-mute">Finishing sign-in…</p>
    </div>
  );
}
