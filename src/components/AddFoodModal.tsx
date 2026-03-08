import { useState } from 'react';
import { ChevronDown, ChevronUp, Beaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NutrientData, NUTRIENT_CATEGORIES, NUTRIENT_LABELS, NUTRIENT_UNITS, CustomNutrient } from '@/types/nutrients';
import { validateFoodName, validateBarcode, validateBrand, validateServingSize, validateServingUnit, validateNutrientValue, sanitizeText } from '@/lib/inputSanitization';

interface AddFoodModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (food: { name: string; barcode?: string; brand?: string; servingSize: number; servingUnit: string; nutrients: NutrientData }) => void;
  initialData?: Partial<NutrientData>;
  initialName?: string;
  customNutrients?: CustomNutrient[];
}

export function AddFoodModal({ open, onClose, onAdd, initialData, initialName, customNutrients = [] }: AddFoodModalProps) {
  const [name, setName] = useState(initialName || '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [nutrients, setNutrients] = useState<NutrientData>(initialData || {});
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['macros']);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const nameCheck = validateFoodName(name);
    if (!nameCheck.valid) errors.name = nameCheck.error!;

    const barcodeCheck = validateBarcode(barcode.trim());
    if (!barcodeCheck.valid) errors.barcode = barcodeCheck.error!;

    const brandCheck = validateBrand(brand.trim());
    if (!brandCheck.valid) errors.brand = brandCheck.error!;

    const sizeCheck = validateServingSize(parseFloat(servingSize) || 0);
    if (!sizeCheck.valid) errors.servingSize = sizeCheck.error!;

    const unitCheck = validateServingUnit(servingUnit);
    if (!unitCheck.valid) errors.servingUnit = unitCheck.error!;

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    onAdd({
      name: sanitizeText(name, 200),
      brand: brand.trim() ? sanitizeText(brand, 100) : undefined,
      barcode: barcode.trim() || undefined,
      servingSize: parseFloat(servingSize) || 100,
      servingUnit: servingUnit.trim(),
      nutrients,
    });

    setName('');
    setBrand('');
    setBarcode('');
    setServingSize('100');
    setNutrients({});
    onClose();
  };

  const updateNutrient = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (value === '') {
      const newNutrients = { ...nutrients };
      delete newNutrients[key as keyof NutrientData];
      setNutrients(newNutrients);
    } else if (!isNaN(numValue) && validateNutrientValue(numValue)) {
      setNutrients(prev => ({ ...prev, [key]: numValue }));
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
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 bg-card border-border rounded-3xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl">Add Food</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[55vh] px-6">
            <div className="space-y-5 pb-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-muted-foreground">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 200))}
                    placeholder="e.g., Oatmeal"
                    className={`bg-secondary border-0 rounded-xl ${validationErrors.name ? 'ring-2 ring-destructive' : ''}`}
                    required
                    maxLength={200}
                  />
                  {validationErrors.name && <p className="text-xs text-destructive">{validationErrors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Brand</Label>
                    <Input
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      placeholder="Optional"
                      className="bg-secondary border-0 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Barcode</Label>
                    <Input
                      value={barcode}
                      onChange={e => setBarcode(e.target.value)}
                      placeholder="Optional"
                      className="bg-secondary border-0 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Serving Size</Label>
                    <Input
                      type="number"
                      value={servingSize}
                      onChange={e => setServingSize(e.target.value)}
                      min="1"
                      className="bg-secondary border-0 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Unit</Label>
                    <Input
                      value={servingUnit}
                      onChange={e => setServingUnit(e.target.value)}
                      placeholder="g, ml, oz..."
                      className="bg-secondary border-0 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Nutrients */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Nutrients (per 100g)
                </h3>

                {Object.entries(NUTRIENT_CATEGORIES).map(([category, nutrientKeys]) => (
                  <div key={category} className="rounded-2xl overflow-hidden bg-secondary">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between p-4"
                    >
                      <span className="font-medium capitalize">{category}</span>
                      {expandedCategories.includes(category) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {expandedCategories.includes(category) && (
                      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                        {nutrientKeys.map(key => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {NUTRIENT_LABELS[key]} ({NUTRIENT_UNITS[key]})
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={nutrients[key as keyof NutrientData] ?? ''}
                              onChange={e => updateNutrient(key, e.target.value)}
                              placeholder="0"
                              className="h-9 bg-muted border-0 rounded-xl text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Custom Nutrients */}
                {customNutrients.length > 0 && (
                  <div className="rounded-2xl overflow-hidden bg-secondary">
                    <button
                      type="button"
                      onClick={() => toggleCategory('custom')}
                      className="w-full flex items-center justify-between p-4"
                    >
                      <span className="font-medium flex items-center gap-1.5">
                        <Beaker className="h-4 w-4 text-accent" />
                        Custom
                      </span>
                      {expandedCategories.includes('custom') ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {expandedCategories.includes('custom') && (
                      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                        {customNutrients.map(n => (
                          <div key={n.id} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {n.label} ({n.unit})
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={nutrients[n.id] ?? ''}
                              onChange={e => updateNutrient(n.id, e.target.value)}
                              placeholder="0"
                              className="h-9 bg-muted border-0 rounded-xl text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="flex gap-3 p-6 pt-4">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onClose}
              className="flex-1 ios-button-secondary"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim()}
              className="flex-1 ios-button-primary"
            >
              Add Food
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
