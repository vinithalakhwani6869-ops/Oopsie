import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children, className = '' }) {
  if (!children) return null;
  return (
    <div className={`prose-oopsie ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(children)}</ReactMarkdown>
    </div>
  );
}
