import { AlertTriangle, Inbox, Loader2, RotateCw, Star } from 'lucide-react';
import { cx, DIFFICULTY_LABELS, DIFFICULTY_TONES, MODE_LABELS, initials } from '../lib/format.js';

const VARIANTS = {
  primary:
    'bg-coral-500 text-white shadow-[0_3px_0_0_#a93217] hover:bg-coral-400 hover:shadow-[0_3px_0_0_#8f2a13] active:translate-y-[2px] active:shadow-[0_1px_0_0_#a93217]',
  dark: 'bg-ink text-cream shadow-[0_3px_0_0_#000] hover:bg-ink-soft active:translate-y-[2px] active:shadow-[0_1px_0_0_#000]',
  outline: 'border border-ink/20 bg-white/60 text-ink hover:border-ink/35 hover:bg-white',
  soft: 'bg-coral-100 text-coral-700 hover:bg-coral-200',
  ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink',
  success:
    'bg-mint-600 text-white shadow-[0_3px_0_0_#047857] hover:bg-mint-500 active:translate-y-[2px] active:shadow-[0_1px_0_0_#047857]',
  danger: 'bg-white border border-coral-200 text-coral-700 hover:bg-coral-50',
};

const SIZES = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-13 px-6 text-[0.95rem] gap-2.5 rounded-2xl',
};

export function buttonClasses({ variant = 'primary', size = 'md', className = '' } = {}) {
  return cx(
    'inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    className,
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', as: Tag = 'div', ...props }) {
  return (
    <Tag className={cx('card', className)} {...props}>
      {children}
    </Tag>
  );
}

const TONES = {
  neutral: 'bg-ink/5 text-ink-soft',
  coral: 'bg-coral-100 text-coral-700',
  mint: 'bg-mint-100 text-mint-700',
  sun: 'bg-sun-100 text-sun-700',
  sky: 'bg-sky-100 text-sky-700',
  ink: 'bg-ink text-cream',
  outline: 'border border-ink/15 bg-transparent text-ink-soft',
};

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em]',
        TONES[tone] || TONES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DifficultyBadge({ difficulty }) {
  return <Badge tone={DIFFICULTY_TONES[difficulty] || 'neutral'}>{DIFFICULTY_LABELS[difficulty] || difficulty}</Badge>;
}

export function ModeBadge({ mode }) {
  const tone = mode === 'self_study' ? 'sky' : mode === 'spot_flaw' ? 'sun' : mode === 'practice_similar' ? 'coral' : 'neutral';
  return <Badge tone={tone}>{MODE_LABELS[mode] || mode}</Badge>;
}

export function Spinner({ className = 'h-6 w-6', label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center justify-center">
      <Loader2 className={cx('animate-spin text-coral-500', className)} />
    </span>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={cx('animate-pulse rounded-2xl bg-ink/10', className)} />;
}

export function ErrorBanner({ error, onRetry, className = '' }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div
      className={cx(
        'flex flex-col gap-3 rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      role="alert"
    >
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 bg-white">
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-ink/5 text-ink-mute">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-ink-mute">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 'md', className = '' }) {
  const sizes = { sm: 'h-8 w-8 text-[0.65rem]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-base' };
  if (src) {
    return <img src={src} alt="" className={cx('rounded-full object-cover', sizes[size], className)} />;
  }
  return (
    <span
      className={cx(
        'inline-grid place-items-center rounded-full bg-ink font-semibold tracking-wide text-cream',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value = 0, tone = 'coral', className = '' }) {
  const tones = {
    coral: 'bg-coral-500',
    mint: 'bg-mint-500',
    sun: 'bg-sun-500',
    ink: 'bg-ink',
  };
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-ink/10', className)}>
      <div
        className={cx('h-full rounded-full transition-all duration-500', tones[tone] || tones.coral)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Stat({ label, value, icon: Icon, hint, className = '' }) {
  return (
    <Card className={cx('p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-mute">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-coral-400" aria-hidden="true" />}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </Card>
  );
}

export function PointsBadge({ points, status, className = '' }) {
  const label =
    status === 'solved'
      ? `+${points || 0} pts`
      : status === 'revealed'
        ? '0 pts'
        : `${points || 0} ${points === 1 ? 'pt' : 'pts'} left`;

  const tone =
    status === 'solved'
      ? 'border-mint-200 bg-mint-50 text-mint-700'
      : status === 'revealed'
        ? 'border-ink/10 bg-ink/5 text-ink-mute'
        : 'border-sun-200 bg-sun-50 text-sun-700';

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold tabular-nums',
        tone,
        className,
      )}
    >
      <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
      {label}
    </span>
  );
}
