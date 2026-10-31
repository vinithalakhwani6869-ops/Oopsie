import { Check } from 'lucide-react';
import { cx, HINT_STAGES } from '../lib/format.js';

/**
 * Three-dot progress indicator for the Hint Ladder.
 * variant="compact" for headers, default for the session panel.
 */
export function DotLadder({ hintsUsed = 0, status = 'in_progress', variant = 'default', className = '' }) {
  const used = Math.max(0, Math.min(3, hintsUsed || 0));
  const dots = [1, 2, 3];

  return (
    <div className={cx('flex items-center gap-2', className)} aria-label={`${used} of 3 hints used`}>
      {dots.map((level, index) => {
        const filled = used >= level;
        return (
          <div key={level} className="flex items-center gap-2">
            <span
              className={cx(
                'grid place-items-center rounded-full border-2 font-bold transition-all',
                variant === 'compact' ? 'h-5 w-5 text-[0.55rem]' : 'h-7 w-7 text-[0.65rem]',
                filled
                  ? status === 'solved'
                    ? 'border-mint-500 bg-mint-500 text-white'
                    : 'border-sun-500 bg-sun-500 text-white'
                  : 'border-ink/20 bg-white text-ink-mute',
              )}
            >
              {filled && status === 'solved' ? (
                <Check className={variant === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
              ) : (
                level
              )}
            </span>
            {index < dots.length - 1 && (
              <span
                className={cx(
                  'h-[2px] rounded-full transition-colors',
                  variant === 'compact' ? 'w-3' : 'w-5 sm:w-8',
                  used > level ? 'bg-sun-400' : 'bg-ink/15',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HintLadderPanel({ hintsUsed, status }) {
  const used = Math.max(0, Math.min(3, hintsUsed || 0));
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {HINT_STAGES.map((stage) => {
        const filled = used >= stage.level;
        return (
          <div
            key={stage.level}
            className={cx(
              'rounded-2xl border px-3 py-2.5 transition-all',
              filled ? 'border-sun-200 bg-sun-50' : 'border-ink/10 bg-white/50',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cx(
                  'h-2 w-2 rounded-full',
                  filled ? 'bg-sun-500' : 'bg-ink/20',
                )}
              />
              <p className={cx('text-[0.68rem] font-bold uppercase tracking-[0.08em]', filled ? 'text-sun-700' : 'text-ink-mute')}>
                {stage.short}
              </p>
            </div>
            <p className="mt-1 text-[0.7rem] leading-4 text-ink-mute">{stage.blurb}</p>
          </div>
        );
      })}
    </div>
  );
}
