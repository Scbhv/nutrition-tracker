import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  /** Render as a collapsible group (used for advanced / rarely-used settings). */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

/**
 * Grouped settings section with an iOS-style uppercase header.
 * Keeps the Profile / Settings screen scannable by clustering related controls.
 */
export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = true,
}: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  const header = (
    <div className="flex items-center gap-2 px-1">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />}
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
        {title}
      </span>
      {collapsible && (
        <ChevronDown
          className={cn(
            'ml-auto h-4 w-4 text-muted-foreground/60 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      )}
    </div>
  );

  return (
    <section className="space-y-2.5">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={isOpen}
          className="w-full py-1 rounded-xl transition-opacity active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {header}
        </button>
      ) : (
        header
      )}

      {description && isOpen && (
        <p className="px-1 -mt-1 text-[12px] text-muted-foreground/60">{description}</p>
      )}

      {isOpen && <div className="space-y-3 animate-fade-in">{children}</div>}
    </section>
  );
}
