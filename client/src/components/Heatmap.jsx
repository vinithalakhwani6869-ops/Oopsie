import { Flame, Info } from 'lucide-react';
import { Card } from './ui.jsx';
import { cx, formatDate } from '../lib/format.js';

const LEVEL_CLASSES = [
  'bg-ink/[0.06]',
  'bg-mint-100',
  'bg-mint-200',
  'bg-mint-500',
  'bg-mint-700',
];

const LEVEL_LABELS = ['No sessions', '1–2 sessions', '3–4 sessions', '5–6 sessions', '7+ sessions'];

function toWeeks(cells) {
  if (!cells.length) return [];
  const firstDay = new Date(`${cells[0].date}T00:00:00.000Z`).getUTCDay();
  const padded = [...Array(firstDay).fill(null), ...cells];
  const weeks = [];
  for (let index = 0; index < padded.length; index += 7) {
    const week = padded.slice(index, index + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function monthLabel(week) {
  const first = week.find(Boolean);
  if (!first) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(
    new Date(`${first.date}T00:00:00.000Z`),
  );
}

export function Heatmap({ cells = [] }) {
  const weeks = toWeeks(cells);
  const activeDays = cells.filter((cell) => cell.count > 0).length;
  const totalSessions = cells.reduce((sum, cell) => sum + cell.count, 0);
  const labels = weeks.map(monthLabel);
  const start = cells[0]?.date;
  const end = cells[cells.length - 1]?.date;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Flame className="h-4 w-4 text-coral-500" /> Consistency
          </h2>
          <p className="mt-1 text-xs leading-5 text-ink-mute">
            {start && end ? `${formatDate(start)} – ${formatDate(end)}` : 'Your last 365 days'} · {activeDays} active
            day{activeDays === 1 ? '' : 's'} · {totalSessions} session{totalSessions === 1 ? '' : 's'}
          </p>
        </div>
        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-ink-mute">
          UTC days
        </span>
      </div>

      {weeks.length ? (
        <div className="mt-5 overflow-x-auto pb-1">
          <div className="inline-flex min-w-full flex-col gap-1.5">
            <div className="flex gap-1 pl-0">
              {weeks.map((week, index) => (
                <div key={`month-${index}`} className="relative h-3 w-2.5 shrink-0 sm:w-3">
                  {labels[index] && labels[index] !== labels[index - 1] && (
                    <span className="absolute left-0 top-0 whitespace-nowrap text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-ink-mute">
                      {labels[index]}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="flex flex-col gap-1">
                  {week.map((cell, dayIndex) =>
                    cell ? (
                      <div
                        key={cell.date}
                        className={cx('h-2.5 w-2.5 rounded-[3px] sm:h-3 sm:w-3', LEVEL_CLASSES[cell.level] || LEVEL_CLASSES[0])}
                        title={`${formatDate(cell.date, { year: undefined })} — ${cell.count} session${cell.count === 1 ? '' : 's'} (${LEVEL_LABELS[cell.level]})`}
                      />
                    ) : (
                      <div key={`empty-${weekIndex}-${dayIndex}`} className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink-mute">No activity yet. Your heatmap fills in after the first session.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3">
        <p className="flex items-center gap-1.5 text-[0.68rem] leading-4 text-ink-mute">
          <Info className="h-3 w-3 shrink-0" /> Each square is one UTC day. Streaks follow the same clock.
        </p>
        <div className="flex items-center gap-1.5 text-[0.62rem] text-ink-mute">
          <span>Less</span>
          {LEVEL_CLASSES.map((tone, index) => (
            <span
              key={tone}
              className={cx('h-2.5 w-2.5 rounded-[3px] sm:h-3 sm:w-3', tone)}
              title={LEVEL_LABELS[index]}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </Card>
  );
}
