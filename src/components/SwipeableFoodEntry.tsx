import { useState, useRef } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { FoodItem, FoodEntry } from '@/types/nutrients';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface SwipeableFoodEntryProps {
  food: FoodItem;
  entry: FoodEntry;
  onRemove: () => void;
  onUpdatePortion?: (grams: number) => void;
}

export function SwipeableFoodEntry({ food, entry, onRemove, onUpdatePortion }: SwipeableFoodEntryProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swipedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = -80;
  const MAX_SWIPE = -100;

  const currentGrams = Math.round(entry.servingAmount * food.servingSize);
  const [draftGrams, setDraftGrams] = useState(String(currentGrams));

  const multiplier = (entry.servingAmount * food.servingSize) / 100;
  const calories = (food.nutrients['energy-kcal'] || 0) * multiplier;
  const protein = (food.nutrients['proteins'] || 0) * multiplier;
  const carbs = (food.nutrients['carbohydrates'] || 0) * multiplier;
  const fat = (food.nutrients['fat'] || 0) * multiplier;

  const time = new Date(entry.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const editedLabel = (() => {
    if (!entry.editedAt) return null;
    const diffMs = Date.now() - new Date(entry.editedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(entry.editedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
  })();

  const previousGrams = entry.previousServingAmount !== undefined
    ? Math.round(entry.previousServingAmount * food.servingSize)
    : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = translateX;
    swipedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX.current;
    if (Math.abs(diff) > 6) swipedRef.current = true;
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

  const handleCardClick = () => {
    if (swipedRef.current || translateX !== 0) {
      setTranslateX(0);
      return;
    }
    if (onUpdatePortion) {
      setDraftGrams(String(currentGrams));
      setEditOpen(true);
    }
  };

  const handleSavePortion = () => {
    const grams = parseFloat(draftGrams);
    if (!isNaN(grams) && grams > 0 && onUpdatePortion) {
      onUpdatePortion(grams);
      setEditOpen(false);
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

  const presets = [50, 100, 150, 200];

  return (
    <>
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-[20px]"
      >
        <div className="absolute inset-0 bg-destructive flex items-center justify-end px-6 rounded-[20px]">
          <button 
            onClick={handleDelete}
            className="flex flex-col items-center text-destructive-foreground"
          >
            <Trash2 className="h-6 w-6" />
            <span className="text-xs mt-1">Delete</span>
          </button>
        </div>

        <div
          className={cn(
            "bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 relative border border-border/30 shadow-sm cursor-pointer active:scale-[0.99]",
            isDragging ? "" : "transition-transform duration-200"
          )}
          style={{ transform: `translateX(${translateX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleCardClick}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-[15px] text-foreground truncate tracking-tight">{food.name}</h4>
              </div>
              
              <p className="text-[13px] text-muted-foreground/70 mb-3 flex items-center gap-1.5">
                {currentGrams}{food.servingUnit} • {time}
                {onUpdatePortion && <Pencil className="h-3 w-3 opacity-50" />}
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

            <div className="flex flex-col items-center justify-center opacity-20">
              <div className="w-[3px] h-7 bg-muted-foreground/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="tracking-tight">{food.name}</DialogTitle>
            <DialogDescription>
              Adjust the portion — nutrients will recalculate automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Portion ({food.servingUnit})</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={draftGrams}
                onChange={(e) => setDraftGrams(e.target.value)}
                min="1"
                className="h-12 text-lg text-center bg-secondary border-0 rounded-2xl"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setDraftGrams(String(p))}
                  className={cn(
                    "h-10 rounded-xl text-sm font-medium transition-all",
                    parseFloat(draftGrams) === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p}g
                </button>
              ))}
            </div>

            {(() => {
              const g = parseFloat(draftGrams);
              if (isNaN(g) || g <= 0) return null;
              const m = g / 100;
              const kcal = (food.nutrients['energy-kcal'] || 0) * m;
              return (
                <div className="rounded-2xl bg-card/60 border border-border/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground/70">New calories</p>
                  <p className="text-2xl font-semibold text-foreground tracking-tight">{kcal.toFixed(0)} kcal</p>
                </div>
              );
            })()}

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1 h-11 rounded-2xl">
                Cancel
              </Button>
              <Button onClick={handleSavePortion} className="flex-1 h-11 rounded-2xl">
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
