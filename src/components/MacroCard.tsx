import { cn } from '@/lib/utils';

interface MacroCardProps {
  label: string;
  value: number;
  unit: string;
  goal: number;
  color: string;
  icon?: React.ReactNode;
}

export function MacroCard({ label, value, unit, goal, color, icon }: MacroCardProps) {
  const percentage = Math.min((value / goal) * 100, 100);
  
  return (
    <div className="glass-card rounded-2xl p-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        {icon && (
          <div className={cn("w-2 h-2 rounded-full", color)} />
        )}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-bold text-foreground">{value.toFixed(0)}</span>
        <span className="text-sm text-muted-foreground">/ {goal}{unit}</span>
      </div>
      
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
