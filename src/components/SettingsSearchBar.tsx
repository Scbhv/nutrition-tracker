import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { getSuggestions, type SettingsSuggestion } from '@/lib/settingsSearch';
import { HighlightText } from '@/components/HighlightText';
import { cn } from '@/lib/utils';

interface SettingsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** Number of visible settings for the current query (for screen-reader announcements). */
  resultCount: number;
}

/**
 * Accessible settings search field with typeahead suggestions.
 * Implements the ARIA combobox pattern (listbox popup, arrow-key navigation,
 * Enter to apply, Escape to dismiss/clear) plus a live-region result count.
 */
export function SettingsSearchBar({ value, onChange, resultCount }: SettingsSearchBarProps) {
  const inputId = useId();
  const listId = `${inputId}-suggestions`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo<SettingsSuggestion[]>(() => getSuggestions(value), [value]);
  const showList = open && suggestions.length > 0;

  useEffect(() => setActiveIndex(-1), [value]);

  const apply = (s: SettingsSuggestion) => {
    onChange(s.query);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const clear = () => {
    onChange('');
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (showList && activeIndex >= 0) {
        e.preventDefault();
        apply(suggestions[activeIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (showList) setOpen(false);
      else if (value) clear();
    }
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        Search settings
      </label>
      <Search
        aria-hidden="true"
        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground pointer-events-none"
      />
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-describedby={`${inputId}-hint`}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Search settings..."
        className="w-full h-12 pl-10 pr-11 rounded-[16px] bg-card/70 backdrop-blur-2xl border border-border/40 text-[16px] text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus:border-ring/50 shadow-sm transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear settings search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <p id={`${inputId}-hint`} className="sr-only">
        Type to filter settings. Use the arrow keys to browse suggestions, Enter to apply, Escape to clear.
      </p>
      <p aria-live="polite" role="status" className="sr-only">
        {value ? `${resultCount} setting${resultCount === 1 ? '' : 's'} match ${value}` : ''}
      </p>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Settings suggestions"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-[16px] border border-border/40 bg-popover/95 backdrop-blur-2xl shadow-lg animate-fade-in"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                apply(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                i === activeIndex ? 'bg-accent/60' : 'hover:bg-accent/40',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-foreground truncate">
                  <HighlightText text={s.label} query={value.trim().toLowerCase()} />
                </p>
                <p className="text-[12px] text-muted-foreground/70 truncate">{s.section}</p>
              </div>
              {i === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
