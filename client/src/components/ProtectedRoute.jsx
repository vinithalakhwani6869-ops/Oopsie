import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from './ui.jsx';

export function FullPageLoader({ label = 'Warming up Oopsie…' }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-cream shadow-[3px_3px_0_#ee552d]">
        <span className="font-display text-2xl font-bold">!</span>
      </span>
      <Spinner className="h-5 w-5" />
      <p className="text-sm text-ink-mute">{label}</p>
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Checking your session…" />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return children;
}
