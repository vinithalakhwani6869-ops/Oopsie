import { ChevronDown, HelpCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, ProgressBar } from './ui.jsx';
import { cx, formatShortDate, MODE_LABELS, relativeTime } from '../lib/format.js';

function scoreTone(score) {
  if (score >= 75) return { tone: 'mint', label: 'Strong' };
  if (score >= 45) return { tone: 'sun', label: 'Getting there' };
  return { tone: 'coral', label: 'Needs reps' };
}

export function MasteryCard({ row }) {
  const tone = scoreTone(row.score);
  const entries = [...(row.entries || [])].reverse();
  const latest = entries[0];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {row.topic?.slug ? (
            <Link
              to={`/topics/${row.topic.slug}`}
              className="font-display text-lg font-semibold text-ink underline-offset-4 hover:underline"
            >
              {row.topic.name}
            </Link>
          ) : (
            <p className="font-display text-lg font-semibold text-ink">{row.topic?.name || 'Topic'}</p>
          )}
          <p className="mt-0.5 text-[0.68rem] text-ink-mute">
            {row.sample ? `${row.sample} scored attempt${row.sample === 1 ? '' : 's'} in the window` : 'No scored attempts yet'}
            {latest?.at ? ` · last ${relativeTime(latest.at)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={tone.tone}>{tone.label}</Badge>
          <span className="font-display text-2xl font-semibold tabular-nums text-ink">
            {row.score}
            <span className="text-sm font-normal text-ink-mute">/100</span>
          </span>
        </div>
      </div>

      <ProgressBar value={row.score} tone={tone.tone === 'coral' ? 'coral' : tone.tone} className="mt-3" />

      <details className="group mt-3 rounded-2xl border border-ink/10 bg-white/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-semibold text-ink-soft">
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-ink-mute" /> Why this score?
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-mute transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-3 border-t border-ink/10 px-3.5 py-3">
          <p className="text-xs leading-5 text-ink-mute">
            Your last {Math.min(10, row.attempts_count || 10)} scored attempts are weighted by recency, oldest = 1 and
            newest highest. Each attempt counts as points ÷ 3. Reveals count as 0.
          </p>

          <div className="flex flex-wrap gap-2 text-[0.65rem]">
            <span className="rounded-full bg-ink/5 px-2 py-1 font-semibold text-ink-soft">
              weighted sum {row.weighted_sum}
            </span>
            <span className="rounded-full bg-ink/5 px-2 py-1 font-semibold text-ink-soft">
              weight total {row.weight_total}
            </span>
            <span className="rounded-full bg-ink/5 px-2 py-1 font-semibold text-ink-soft">
              {row.attempts_count} attempt{row.attempts_count === 1 ? '' : 's'} all-time
            </span>
          </div>

          {entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-[0.68rem]">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-[0.08em] text-ink-mute">
                    <th className="pb-1.5 pr-2 font-semibold">Attempt</th>
                    <th className="pb-1.5 pr-2 font-semibold">Hints</th>
                    <th className="pb-1.5 pr-2 font-semibold">Points</th>
                    <th className="pb-1.5 pr-2 font-semibold">Weight</th>
                    <th className="pb-1.5 text-right font-semibold">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="text-ink-soft">
                      <td className="py-1.5 pr-2">
                        <span className="block font-medium text-ink">{formatShortDate(entry.at)}</span>
                        <span className="text-[0.6rem] text-ink-mute">
                          {MODE_LABELS[entry.mode] || entry.mode} · {entry.status}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums">{entry.hints_used}</td>
                      <td className="py-1.5 pr-2 tabular-nums">
                        {entry.points}
                        <span className="text-ink-mute">/{entry.potential}</span>
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums">×{entry.weight}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-ink">{entry.contribution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-ink-mute">Solve a question in this topic to start the calculation.</p>
          )}

          <p className={cx('flex items-start gap-1.5 text-[0.62rem] leading-4 text-ink-mute')}>
            <TrendingUp className="mt-0.5 h-3 w-3 shrink-0" /> {row.formula}
          </p>
        </div>
      </details>
    </Card>
  );
}
