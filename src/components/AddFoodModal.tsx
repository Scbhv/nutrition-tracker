import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NutrientData, NUTRIENT_CATEGORIES, NUTRIENT_LABELS, NUTRIENT_UNITS } from '@/types/nutrients';

interface AddFoodModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (food: { name: string; barcode?: string; brand?: string; servingSize: number; servingUnit: string; nutrients: NutrientData }) => void;
  initialData?: Partial<NutrientData>;
  initialName?: string;
}

export function AddFoodModal({ open, onClose, onAdd, initialData, initialName }: AddFoodModalProps) {
  const [name, setName] = useState(initialName || '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [nutrients, setNutrients] = useState<NutrientData>(initialData || {});
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['macros']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      brand: brand.trim() || undefined,
      barcode: barcode.trim() || undefined,
      servingSize: parseFloat(servingSize) || 100,
      servingUnit,
      nutrients,
    });

    // Reset form
    setName('');
    setBrand('');
    setBarcode('');
    setServingSize('100');
    setNutrients({});
    onClose();
  };

  const updateNutrient = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setNutrients(prev => ({ ...prev, [key]: numValue }));
    } else if (value === '') {
      const newNutrients = { ...nutrients };
      delete newNutrients[key as keyof NutrientData];
      setNutrients(newNutrients);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Add New Food</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[60vh] px-6">
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Food Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Oatmeal"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand (optional)</Label>
                    <Input
                      id="brand"
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      placeholder="e.g., Quaker"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode (optional)</Label>
                    <Input
                      id="barcode"
                      value={barcode}
                      onChange={e => setBarcode(e.target.value)}
                      placeholder="e.g., 123456789"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="servingSize">Serving Size</Label>
                    <Input
                      id="servingSize"
                      type="number"
                      value={servingSize}
                      onChange={e => setServingSize(e.target.value)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="servingUnit">Unit</Label>
                    <Input
                      id="servingUnit"
                      value={servingUnit}
                      onChange={e => setServingUnit(e.target.value)}
                      placeholder="g, ml, oz..."
                    />
                  </div>
                </div>
              </div>

              {/* Nutrients */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Nutrients (per 100g)
                </h3>

                {Object.entries(NUTRIENT_CATEGORIES).map(([category, nutrientKeys]) => (
                  <div key={category} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="font-medium capitalize">{category}</span>
                      {expandedCategories.includes(category) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {expandedCategories.includes(category) && (
                      <div className="p-3 grid grid-cols-2 gap-3">
                        {nutrientKeys.map(key => (
                          <div key={key} className="space-y-1">
                            <Label htmlFor={key} className="text-xs">
                              {NUTRIENT_LABELS[key]} ({NUTRIENT_UNITS[key]})
                            </Label>
                            <Input
                              id={key}
                              type="number"
                              step="0.01"
                              min="0"
                              value={nutrients[key as keyof NutrientData] ?? ''}
                              onChange={e => updateNutrient(key, e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Add Food
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
