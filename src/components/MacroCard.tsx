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
    <div className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 animate-slide-up border border-border/30 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <div className={cn("w-[7px] h-[7px] rounded-full", color)} />
          )}
          <span className="text-[13px] font-medium text-muted-foreground tracking-tight">{label}</span>
        </div>
      </div>
      
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-[28px] font-semibold text-foreground tracking-tight leading-none">{value.toFixed(0)}</span>
        <span className="text-[13px] text-muted-foreground/70 font-normal">/ {goal}{unit}</span>
      </div>
      
      <div className="h-[5px] rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
