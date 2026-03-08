import { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { FoodItem, FoodEntry } from '@/types/nutrients';
import { cn } from '@/lib/utils';

interface SwipeableFoodEntryProps {
  food: FoodItem;
  entry: FoodEntry;
  onRemove: () => void;
}

export function SwipeableFoodEntry({ food, entry, onRemove }: SwipeableFoodEntryProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = -80;
  const MAX_SWIPE = -100;

  const multiplier = (entry.servingAmount * food.servingSize) / 100;
  const calories = (food.nutrients['energy-kcal'] || 0) * multiplier;
  const protein = (food.nutrients['proteins'] || 0) * multiplier;
  const carbs = (food.nutrients['carbohydrates'] || 0) * multiplier;
  const fat = (food.nutrients['fat'] || 0) * multiplier;

  const time = new Date(entry.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = translateX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX.current;
    const newTranslate = Math.max(MAX_SWIPE, Math.min(0, currentX.current + diff));
    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (translateX < DELETE_THRESHOLD) {
      setTranslateX(MAX_SWIPE);
    } else {
      setTranslateX(0);
    }
  };

  const handleDelete = () => {
    if (containerRef.current) {
      containerRef.current.style.height = `${containerRef.current.offsetHeight}px`;
      containerRef.current.style.opacity = '1';
      
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = 'all 0.3s ease-out';
          containerRef.current.style.height = '0px';
          containerRef.current.style.opacity = '0';
          containerRef.current.style.marginBottom = '0px';
          containerRef.current.style.padding = '0px';
        }
      });
      
      setTimeout(onRemove, 300);
    } else {
      onRemove();
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-[20px]"
    >
      {/* Delete background */}
      <div className="absolute inset-0 bg-destructive flex items-center justify-end px-6 rounded-[20px]">
        <button 
          onClick={handleDelete}
          className="flex flex-col items-center text-destructive-foreground"
        >
          <Trash2 className="h-6 w-6" />
          <span className="text-xs mt-1">Delete</span>
        </button>
      </div>

      {/* Swipeable card */}
      <div
        className={cn(
          "bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 relative border border-border/30 shadow-sm",
          isDragging ? "" : "transition-transform duration-200"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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

          {/* Swipe hint indicator */}
          <div className="flex flex-col items-center justify-center opacity-20">
            <div className="w-[3px] h-7 bg-muted-foreground/40 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}