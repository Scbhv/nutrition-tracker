import { cn } from '@/lib/utils';

interface HighlightTextProps {
  text: string;
  query?: string;
  className?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renders text with the matching substring visually highlighted.
 * Case-insensitive; preserves original casing of the matched text.
 */
export function HighlightText({ text, query, className }: HighlightTextProps) {
  if (!query || !query.trim()) return <>{text}</>;
  const normalizedQuery = query.toLowerCase();
  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === normalizedQuery ? (
          <mark
            key={i}
            className={cn(
              'bg-primary/25 text-primary rounded-[4px] px-0.5 font-medium',
              className
            )}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
