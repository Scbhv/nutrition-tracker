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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className={cn(
          "text-muted-foreground",
          isOver && "text-destructive font-medium"
        )}>
          {current.toFixed(1)}{unit} / {goal}{unit}
        </span>
      </div>
      <div className="nutrient-bar">
        <div
          className={cn(
            "nutrient-bar-fill",
            isOver ? "bg-destructive" : colorClass
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
