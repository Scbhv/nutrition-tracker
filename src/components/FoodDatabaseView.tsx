import { useState } from 'react';
import { Search, Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FoodItem, NUTRIENT_LABELS, NUTRIENT_UNITS } from '@/types/nutrients';

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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search foods..."
            className="pl-9"
          />
        </div>
        <Button onClick={onAddFood}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={onImport}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {filteredFoods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No foods in your database yet.</p>
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
    <Card className="p-4 glass-card hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-foreground truncate">{food.name}</h4>
            {food.brand && (
              <span className="text-xs text-muted-foreground">({food.brand})</span>
            )}
          </div>

          {food.barcode && (
            <p className="text-xs text-muted-foreground mb-2">
              Barcode: {food.barcode}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{food.servingSize}{food.servingUnit} serving</span>
            <span>•</span>
            <span>{food.nutrients['energy-kcal'] || 0} kcal/100g</span>
            <span>•</span>
            <span>{food.nutrients['proteins'] || 0}g protein</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={onLog} title="Log this food">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
