import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsGroupProps {
  children: ReactNode;
  className?: string;
}

/**
 * iOS-style grouped settings container.
 * Flattens direct child cards into a single cohesive list with separator lines.
 */
export function SettingsGroup({ children, className }: SettingsGroupProps) {
  return (
    <div
      className={cn(
        'settings-group rounded-[20px] bg-card/60 backdrop-blur-2xl border border-border/30 overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  );
}
