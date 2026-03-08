import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FoodItem, FoodEntry } from '@/types/nutrients';
import { cn } from '@/lib/utils';

interface FoodEntryCardProps {
  food: FoodItem;
  entry: FoodEntry;
  onRemove: () => void;
}

export function FoodEntryCard({ food, entry, onRemove }: FoodEntryCardProps) {
  const multiplier = (entry.servingAmount * food.servingSize) / 100;
  const calories = (food.nutrients['energy-kcal'] || 0) * multiplier;
  const protein = (food.nutrients['proteins'] || 0) * multiplier;
  const carbs = (food.nutrients['carbohydrates'] || 0) * multiplier;
  const fat = (food.nutrients['fat'] || 0) * multiplier;

  const time = new Date(entry.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 border border-border/30 shadow-sm animate-slide-up group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-[15px] text-foreground truncate tracking-tight">{food.name}</h4>
          </div>
          
          <p className="text-[13px] text-muted-foreground/70 mb-3">
            {entry.servingAmount} × {food.servingSize}{food.servingUnit} • {time}
          </p>
          
          <div className="flex flex-wrap gap-1.5">
            <span className="nutrient-pill bg-nutrient-energy/15 text-nutrient-energy">
              {calories.toFixed(0)} kcal
            </span>
            <span className="nutrient-pill bg-nutrient-protein/15 text-nutrient-protein">
              {protein.toFixed(0)}g P
            </span>
            <span className="nutrient-pill bg-nutrient-carbs/15 text-nutrient-carbs">
              {carbs.toFixed(0)}g C
            </span>
            <span className="nutrient-pill bg-nutrient-fat/15 text-nutrient-fat">
              {fat.toFixed(0)}g F
            </span>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive rounded-full"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}