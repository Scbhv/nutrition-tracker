import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FoodItem } from '@/types/nutrients';
import { cn } from '@/lib/utils';

interface QuickAddPanelProps {
  foods: FoodItem[];
  onSelect: (foodId: string) => void;
}

export function QuickAddPanel({ foods, onSelect }: QuickAddPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFoods = foods
    .filter(food =>
      food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      food.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 8);

  return (
    <div className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 space-y-4 border border-border/30 shadow-sm animate-slide-up">
      <h3 className="font-semibold text-[15px] text-foreground tracking-tight">Quick Add</h3>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search foods..."
          className="pl-10 bg-muted/40 border-0 rounded-2xl text-[15px]"
        />
      </div>

      <ScrollArea className="h-[180px]">
        <div className="space-y-0.5">
          {filteredFoods.length === 0 ? (
            <p className="text-[13px] text-muted-foreground/70 text-center py-6">
              {searchQuery ? 'No matches' : 'Add foods to database'}
            </p>
          ) : (
            filteredFoods.map(food => (
              <button
                key={food.id}
                onClick={() => onSelect(food.id)}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-secondary/50 transition-colors text-left group"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[14px] text-foreground truncate tracking-tight">{food.name}</p>
                  <p className="text-[12px] text-muted-foreground/70">
                    {food.nutrients['energy-kcal'] || 0} kcal • {food.nutrients['proteins'] || 0}g protein
                  </p>
                </div>
                <div className="p-2 rounded-full bg-primary/15 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="h-4 w-4" />
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}