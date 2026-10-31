export const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const DIFFICULTY_TONES = {
  beginner: 'mint',
  intermediate: 'sun',
  advanced: 'coral',
};

export const MODE_LABELS = {
  practice: 'Practice',
  self_study: 'Self-study',
  practice_similar: 'Similar practice',
  spot_flaw: 'Spot the Flaw',
};

export const HINT_STAGES = [
  { level: 1, short: 'Nudge', label: 'Conceptual nudge', blurb: 'Names the right area — no steps.' },
  { level: 2, short: 'Slip', label: 'Find the slip', blurb: 'Points at where your reasoning diverged.' },
  { level: 3, short: 'Almost', label: 'Nearly there', blurb: 'The next move, without the answer.' },
];

export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(date);
}

export function formatShortDate(value) {
  return formatDate(value, { year: undefined });
}

export function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function signedPoints(points) {
  return `+${points || 0}`;
}
