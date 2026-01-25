import { Calendar, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
  onSettingsClick?: () => void;
  onAddClick?: () => void;
}

export function Header({ title, onSettingsClick, onAddClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 py-4">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        
        <div className="flex items-center gap-2">
          {onSettingsClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSettingsClick}
              className="rounded-full bg-secondary"
            >
              <Calendar className="h-5 w-5" />
            </Button>
          )}
          {onAddClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddClick}
              className="rounded-full bg-secondary"
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
