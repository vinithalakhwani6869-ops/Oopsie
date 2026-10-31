import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Info, Lightbulb, Lock, PenLine, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { Button, Card, ErrorBanner } from '../components/ui.jsx';

const TIPS = [
  'Paste the full question, including units, tables, or code if they matter.',
  'Don’t include the published answer — Oopsie solves it privately.',
  'It works for homework, interview prep, or something you just don’t get.',
];

export function SelfStudyPage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const start = async (event) => {
    event.preventDefault();
    if (question.trim().length < 10) {
      setError('Paste at least a full sentence so the reference solution has something to work with.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await api('/self-study/start', {
        method: 'POST',
        body: { question: question.trim() },
      });
      navigate(`/practice/${payload.attempt.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-coral-600">Self-study</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Bring your own question.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mute">
          Stuck on something from class, a textbook, or a late-night rabbit hole? Oopsie solves it privately, then
          coaches you through the same three-hint ladder before showing the reference.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <Card className="p-5 sm:p-7">
          <form onSubmit={start}>
            <label htmlFor="question" className="label">
              Your question
            </label>
            <textarea
              id="question"
              rows={9}
              value={question}
              maxLength={3000}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. A train leaves at 9:15 and travels 240 km at 80 km/h. When does it arrive? Explain the time arithmetic too."
              className="field min-h-[220px] resize-y text-[0.95rem] leading-7"
              disabled={loading}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-ink-mute">
              <span>One question per session. Vague questions get vague coaching.</span>
              <span className="tabular-nums">{question.length}/3000</span>
            </div>

            <ErrorBanner error={error} className="mt-4" />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-xs text-ink-mute">
                <Lock className="h-3.5 w-3.5" /> The reference solution stays server-side until the ladder ends.
              </p>
              <Button type="submit" size="lg" loading={loading} className="shrink-0">
                <PenLine className="h-4 w-4" /> Start coaching
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-ink p-5 text-cream">
              <p className="flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-cream/60">
                <Bot className="h-3.5 w-3.5" /> How it works
              </p>
              <p className="mt-2 font-display text-xl font-semibold">Private solve. Public reasoning.</p>
            </div>
            <ol className="space-y-4 p-5">
              {[
                ['AI solves it privately', 'A reference answer and worked solution are stored server-side, hidden from you.'],
                ['You attempt it first', 'Your answer is graded against that reference and rubric.'],
                ['Three hints, then the reveal', 'Hints target your actual mistake. The solution appears only at the end.'],
              ].map(([title, copy], index) => (
                <li key={title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral-100 text-xs font-bold text-coral-700">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-mute">{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="border-sun-200 bg-sun-50 p-5">
            <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-sun-700">
              <Sparkles className="h-3.5 w-3.5" /> 0 points, on purpose
            </p>
            <p className="mt-2 text-xs leading-5 text-ink-soft">
              Self-study doesn’t touch the leaderboard — you supply the question. Your streak and mistakes still count.
            </p>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Lightbulb className="h-4 w-4 text-coral-500" /> Better questions
            </p>
            <ul className="mt-3 space-y-2">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2 text-xs leading-5 text-ink-mute">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral-400" />
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-1.5 border-t border-ink/10 pt-3 text-[0.68rem] leading-4 text-ink-mute">
              <Info className="mt-0.5 h-3 w-3 shrink-0" /> AI-generated references can be wrong. Verify anything important.
            </p>
          </Card>

          <Link to="/" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink">
            Prefer a curated topic? Browse topics <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
