import { Link } from 'react-router-dom';
import { Check, Quote } from 'lucide-react';

const STEPS = [
  { label: 'Try it yourself', detail: 'No answer, no peeking.' },
  { label: 'Three hints max', detail: 'Nudge → slip → almost.' },
  { label: 'Then the solution', detail: 'Worked, step by step.' },
];

export function AuthShell({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-10 text-cream lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-coral-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-mint-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 dot-backdrop opacity-[0.06]" />

        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-coral-500 text-white shadow-[2px_2px_0_#000]">
            <span className="font-display text-2xl font-bold leading-none">!</span>
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
            Oopsie<span className="text-coral-400">.</span>
          </span>
        </Link>

        <div className="relative max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cream/70">
            AI learning coach
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            The answer is the last thing you get.
          </h1>
          <p className="mt-4 max-w-md text-[0.95rem] leading-7 text-cream/70">
            Oopsie makes you attempt first, coaches you through three progressive hints, and only reveals a worked
            solution when you've genuinely tried. Wrong answers become the syllabus.
          </p>

          <ol className="mt-8 space-y-3">
            {STEPS.map((step, index) => (
              <li key={step.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-cream">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cream">{step.label}</p>
                  <p className="text-xs text-cream/55">{step.detail}</p>
                </div>
                <Check className="ml-auto h-4 w-4 text-mint-400" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>

        <blockquote className="relative flex max-w-md items-start gap-3 text-sm leading-6 text-cream/60">
          <Quote className="mt-1 h-4 w-4 shrink-0 text-coral-400" aria-hidden="true" />
          <p>"I finally understand recursion because Oopsie refused to show me the code until I'd broken it twice."</p>
        </blockquote>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream shadow-[2px_2px_0_#ee552d]">
              <span className="font-display text-xl font-bold">!</span>
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">
              Oopsie<span className="text-coral-500">.</span>
            </span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
