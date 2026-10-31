import { Binary, Database, Code2, Calculator, Network, Atom, Puzzle, BookOpen, Wallet, Landmark, Apple, Rocket, Sparkles } from 'lucide-react';

const ICONS = {
  binary: Binary,
  database: Database,
  code: Code2,
  calculator: Calculator,
  network: Network,
  atom: Atom,
  puzzle: Puzzle,
  'book-open': BookOpen,
  wallet: Wallet,
  landmark: Landmark,
  apple: Apple,
  rocket: Rocket,
};

const TONES = {
  technical: 'bg-coral-100 text-coral-700',
  'non-technical': 'bg-mint-100 text-mint-700',
};

export function TopicIcon({ icon, category = 'technical', size = 'md', className = '' }) {
  const Icon = ICONS[icon] || Sparkles;
  const sizes = {
    sm: 'h-9 w-9 rounded-xl',
    md: 'h-11 w-11 rounded-2xl',
    lg: 'h-16 w-16 rounded-3xl',
  };
  const iconSizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' };
  return (
    <span className={`grid shrink-0 place-items-center ${sizes[size]} ${TONES[category] || TONES.technical} ${className}`}>
      <Icon className={iconSizes[size]} aria-hidden="true" />
    </span>
  );
}
