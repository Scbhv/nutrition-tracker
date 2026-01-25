import { cn } from '@/lib/utils';
import { NUTRIENT_LABELS, NUTRIENT_UNITS } from '@/types/nutrients';

interface NutrientBarProps {
  nutrient: string;
  current: number;
  goal: number;
  colorClass?: string;
}

export function NutrientBar({ nutrient, current, goal, colorClass = 'bg-primary' }: NutrientBarProps) {
  const percentage = Math.min((current / goal) * 100, 100);
  const isOver = current > goal;
  const label = NUTRIENT_LABELS[nutrient] || nutrient;
  const unit = NUTRIENT_UNITS[nutrient] || '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className={cn(
          "text-muted-foreground tabular-nums",
          isOver && "text-destructive font-medium"
        )}>
          {current.toFixed(0)} / {goal}{unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOver ? "bg-destructive" : colorClass
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
