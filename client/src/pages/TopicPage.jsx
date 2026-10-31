import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Lightbulb,
  PenLine,
  Play,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { TopicIcon } from '../components/TopicIcon.jsx';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  DifficultyBadge,
  ErrorBanner,
  Skeleton,
} from '../components/ui.jsx';
import { cx, DIFFICULTY_LABELS } from '../lib/format.js';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

function LessonSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-28 w-full rounded-3xl" />
    </div>
  );
}

function LessonContent({ lesson }) {
  if (!lesson) return null;
  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{lesson.title}</h2>
      <p className="mt-3 text-[0.95rem] leading-7 text-ink-soft">{lesson.summary}</p>

      <div className="mt-7 space-y-7">
        {lesson.sections?.map((section, index) => (
          <section key={`${section.heading}-${index}`}>
            <div className="flex items-baseline gap-2">
              <span className="text-[0.68rem] font-bold tabular-nums text-coral-500">0{index + 1}</span>
              <h3 className="font-display text-lg font-semibold text-ink">{section.heading}</h3>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[0.92rem] leading-7 text-ink-soft">{section.body}</p>
          </section>
        ))}
      </div>

      {lesson.key_takeaways?.length > 0 && (
        <div className="mt-8 rounded-3xl border border-mint-200 bg-mint-50 p-5">
          <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-mint-700">
            <Sparkles className="h-3.5 w-3.5" /> Key takeaways
          </p>
          <ul className="mt-3 space-y-2">
            {lesson.key_takeaways.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-6 text-ink-soft">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mint-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lesson.check_yourself && (
        <div className="mt-4 flex gap-3 rounded-3xl border border-sun-200 bg-sun-50 p-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-sun-700" aria-hidden="true" />
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-sun-700">Check yourself</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{lesson.check_yourself}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopicPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [resources, setResources] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [difficulty, setDifficulty] = useState('beginner');
  const [lessons, setLessons] = useState({});
  const [lessonLoading, setLessonLoading] = useState(true);
  const [lessonError, setLessonError] = useState(null);
  const [lessonNonce, setLessonNonce] = useState(0);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api(`/topics/${slug}`)
      .then((data) => {
        if (!active) return;
        setTopic(data.topic);
        setResources(data.resources || []);
        setCounts(data.question_counts);
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!topic) return undefined;
    let active = true;

    if (lessons[difficulty]) {
      setLessonLoading(false);
      setLessonError(null);
      return undefined;
    }

    setLessonLoading(true);
    setLessonError(null);
    api(`/topics/${slug}/lesson?difficulty=${difficulty}`)
      .then((data) => {
        if (!active) return;
        setLessons((current) => ({ ...current, [difficulty]: data.lesson }));
      })
      .catch((err) => active && setLessonError(err))
      .finally(() => active && setLessonLoading(false));

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id, slug, difficulty, lessonNonce]);

  const startPractice = async () => {
    if (!topic) return;
    setStarting(true);
    setStartError(null);
    try {
      const payload = await api('/practice/start', {
        method: 'POST',
        body: { topic_id: topic.id, difficulty },
      });
      navigate(`/practice/${payload.attempt.id}`);
    } catch (err) {
      setStartError(err);
    } finally {
      setStarting(false);
    }
  };

  const retryLesson = () => {
    setLessons((current) => {
      const next = { ...current };
      delete next[difficulty];
      return next;
    });
    setLessonNonce((value) => value + 1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-[520px] w-full rounded-4xl" />
          <Skeleton className="h-80 w-full rounded-4xl" />
        </div>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="space-y-4">
        <ErrorBanner error={error || 'Topic not found.'} onRetry={() => window.location.reload()} />
        <Link to="/" className={buttonClasses({ variant: 'outline' })}>
          <ArrowLeft className="h-4 w-4" /> Back to topics
        </Link>
      </div>
    );
  }

  const lesson = lessons[difficulty];

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All topics
      </Link>

      <section className="flex flex-col gap-5 rounded-4xl border border-ink/10 bg-paper p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-start gap-4">
          <TopicIcon icon={topic.icon} category={topic.category} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={topic.category === 'technical' ? 'coral' : 'mint'}>
                {topic.category === 'technical' ? 'Technical' : 'Everyday'}
              </Badge>
              <DifficultyBadge difficulty={difficulty} />
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{topic.name}</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-ink-mute">{topic.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button onClick={startPractice} loading={starting} size="lg">
            <Play className="h-4 w-4" /> Skip to questions
          </Button>
          <span className="text-center text-[0.68rem] text-ink-mute sm:text-right">
            {counts?.[difficulty] || 0} {DIFFICULTY_LABELS[difficulty].toLowerCase()} questions ready
          </span>
        </div>
      </section>

      {startError && <ErrorBanner error={startError} onRetry={startPractice} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5 sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BookOpen className="h-4 w-4 text-coral-500" /> Study mode
            </div>
            <div className="flex gap-1 rounded-full bg-ink/5 p-1">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={cx(
                    'rounded-full px-3 py-1.5 text-[0.7rem] font-semibold capitalize transition',
                    difficulty === level ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink',
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {lessonError ? (
            <div className="space-y-4">
              <ErrorBanner error={lessonError} onRetry={retryLesson} />
              <p className="text-sm leading-6 text-ink-mute">
                The lesson is generated on demand, so it needs the AI provider to be configured. You can still skip
                straight to the questions, or open a curated resource on the right.
              </p>
              <Button variant="dark" onClick={startPractice} loading={starting}>
                Skip to questions <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : lessonLoading || !lesson ? (
            <LessonSkeleton />
          ) : (
            <LessonContent lesson={lesson} />
          )}
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card className="overflow-hidden">
            <div className="bg-ink p-5 text-cream">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-cream/60">Practice</p>
              <p className="mt-1 font-display text-xl font-semibold">{DIFFICULTY_LABELS[difficulty]} mode</p>
              <p className="mt-1 text-xs leading-5 text-cream/60">Hints first. Solution last. Points depend on how few you use.</p>
            </div>
            <div className="p-5">
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[3, 2, 1].map((points, index) => (
                  <div key={points} className="rounded-xl border border-ink/10 bg-white/60 px-2 py-2 text-center">
                    <p className="font-display text-lg font-semibold text-ink">{points}</p>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-ink-mute">
                      {index === 0 ? 'no hint' : `${index} hint${index > 1 ? 's' : ''}`}
                    </p>
                  </div>
                ))}
              </div>
              <Button className="w-full" size="lg" onClick={startPractice} loading={starting}>
                Start practice <ArrowRight className="h-4 w-4" />
              </Button>
              <Link to="/self-study" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink">
                <PenLine className="h-3.5 w-3.5" /> Or paste your own question
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">Go deeper</h2>
              <Badge tone="outline">Curated</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-mute">Hand-picked places to read, watch, or practise. Opens externally.</p>
            <ul className="mt-4 space-y-2">
              {resources.map((resource) => (
                <li key={resource.url}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex items-start gap-3 rounded-2xl border border-ink/10 bg-white/50 p-3 transition hover:border-coral-200 hover:bg-white"
                  >
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-coral-500" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-5 text-ink group-hover:text-coral-700">{resource.title}</span>
                      <span className="mt-0.5 block text-[0.7rem] leading-4 text-ink-mute">{resource.blurb}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
