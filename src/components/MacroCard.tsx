import { cn } from '@/lib/utils';

interface MacroCardProps {
  label: string;
  value: number;
  unit: string;
  goal: number;
  icon: React.ReactNode;
  colorClass: string;
}

export function MacroCard({ label, value, unit, goal, icon, colorClass }: MacroCardProps) {
  const percentage = Math.min((value / goal) * 100, 100);
  
  return (
    <div className="glass-card rounded-xl p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("p-2 rounded-lg", colorClass)}>
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{value.toFixed(0)}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        
        <div className="nutrient-bar h-1.5">
          <div
            className={cn("nutrient-bar-fill", colorClass)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <p className="text-xs text-muted-foreground">
          {percentage.toFixed(0)}% of {goal}{unit} goal
        </p>
      </div>
    </div>
  );
}
