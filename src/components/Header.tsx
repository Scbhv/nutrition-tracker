import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
  onSettingsClick?: () => void;
  onAddClick?: () => void;
}

export function Header({ title, onSettingsClick, onAddClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-background/70 backdrop-blur-2xl">
      <div className="flex items-center justify-between px-5 py-3">
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">{title}</h1>
        
        <div className="flex items-center gap-1.5">
          {onSettingsClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSettingsClick}
              className="rounded-full bg-secondary/60 backdrop-blur-sm h-9 w-9"
            >
              <Calendar className="h-[18px] w-[18px]" />
            </Button>
          )}
          {onAddClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddClick}
              className="rounded-full bg-secondary/60 backdrop-blur-sm h-9 w-9"
            >
              <Plus className="h-[18px] w-[18px]" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
