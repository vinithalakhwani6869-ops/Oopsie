import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, Spinner } from '../components/ui.jsx';

export function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const description = params.get('error_description') || hashParams.get('error_description');
    if (description) setError(description);
  }, []);

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
      return;
    }
    if (!loading) {
      const timer = setTimeout(() => setTimedOut(true), 3500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [session, loading, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-coral-100 text-xl font-bold text-coral-700">!</span>
          <h1 className="mt-4 font-display text-2xl font-semibold">Sign-in didn't finish</h1>
          <p className="mt-2 text-sm leading-6 text-ink-mute">{error}</p>
          <Link to="/login" className="mt-6 inline-flex">
            <Button>Back to sign in</Button>
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
            The magic link may have expired. Try signing in again — or check that this URL is listed in your Supabase
            redirect settings.
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
