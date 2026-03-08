import { cn } from '@/lib/utils';
import { NUTRIENT_LABELS, NUTRIENT_UNITS } from '@/types/nutrients';

interface NutrientBarProps {
  nutrient: string;
  current: number;
  goal: number;
  colorClass?: string;
  customLabel?: string;
  customUnit?: string;
}

export function NutrientBar({ nutrient, current, goal, colorClass = 'bg-primary', customLabel, customUnit }: NutrientBarProps) {
  const percentage = Math.min((current / goal) * 100, 100);
  const isOver = current > goal;
  const label = customLabel || NUTRIENT_LABELS[nutrient] || nutrient;
  const unit = customUnit || NUTRIENT_UNITS[nutrient] || '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-foreground tracking-tight">{label}</span>
        <span className={cn(
          "text-muted-foreground/70 tabular-nums",
          isOver && "text-destructive font-medium"
        )}>
          {current.toFixed(0)} / {goal}{unit}
        </span>
      </div>
      <div className="h-[5px] rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isOver ? "bg-destructive" : colorClass
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}