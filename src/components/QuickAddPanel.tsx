import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FoodItem } from '@/types/nutrients';

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
    .slice(0, 10);

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-foreground">Quick Add</h3>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search your foods..."
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-1">
          {filteredFoods.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchQuery ? 'No matching foods found' : 'Add foods to your database first'}
            </p>
          ) : (
            filteredFoods.map(food => (
              <button
                key={food.id}
                onClick={() => onSelect(food.id)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors text-left group"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{food.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {food.nutrients['energy-kcal'] || 0} kcal per 100g
                  </p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
