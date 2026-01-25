import { useState } from 'react';
import { Search, Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FoodItem } from '@/types/nutrients';
import { cn } from '@/lib/utils';

interface FoodDatabaseViewProps {
  foods: FoodItem[];
  onAddFood: () => void;
  onEditFood: (food: FoodItem) => void;
  onDeleteFood: (id: string) => void;
  onLogFood: (foodId: string) => void;
  onExport: () => void;
  onImport: () => void;
}

export function FoodDatabaseView({
  foods,
  onAddFood,
  onEditFood,
  onDeleteFood,
  onLogFood,
  onExport,
  onImport,
}: FoodDatabaseViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFoods = foods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.barcode?.includes(searchQuery)
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search & Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search foods..."
            className="pl-10 bg-secondary border-0 rounded-xl"
          />
        </div>
        <Button onClick={onAddFood} className="ios-button-primary">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Export/Import */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onExport} className="rounded-full">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="secondary" size="sm" onClick={onImport} className="rounded-full">
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
      </div>

      {/* Food List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-2 pr-4">
          {filteredFoods.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No foods yet</p>
              <p className="text-sm mt-1">Add your first food to get started!</p>
            </div>
          ) : (
            filteredFoods.map(food => (
              <FoodDatabaseCard
                key={food.id}
                food={food}
                onEdit={() => onEditFood(food)}
                onDelete={() => onDeleteFood(food.id)}
                onLog={() => onLogFood(food.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FoodDatabaseCard({
  food,
  onEdit,
  onDelete,
  onLog,
}: {
  food: FoodItem;
  onEdit: () => void;
  onDelete: () => void;
  onLog: () => void;
}) {
  return (
    <div className="glass-card rounded-2xl p-4 group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0" onClick={onLog}>
          <h4 className="font-semibold text-foreground truncate">{food.name}</h4>
          {food.brand && (
            <p className="text-xs text-muted-foreground">{food.brand}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <span className="text-muted-foreground">{food.servingSize}{food.servingUnit}</span>
            <span className="text-primary">{food.nutrients['energy-kcal'] || 0} kcal</span>
            <span className="text-nutrient-protein">{food.nutrients['proteins'] || 0}g P</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={onLog} className="rounded-full">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} className="rounded-full">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="rounded-full hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
