import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Beaker, Camera, Loader2, RotateCw, ScanBarcode, Sparkles, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { readNutritionLabel, retryBarcodeLookup, estimateMeal } from '@/lib/labelScan';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NutrientData, NUTRIENT_CATEGORIES, NUTRIENT_LABELS, NUTRIENT_UNITS, CustomNutrient } from '@/types/nutrients';
import { validateFoodName, validateBarcode, validateBrand, validateServingSize, validateServingUnit, validateNutrientValue, sanitizeText } from '@/lib/inputSanitization';

interface AddFoodModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (food: { name: string; barcode?: string; brand?: string; servingSize: number; servingUnit: string; nutrients: NutrientData }) => void;
  initialData?: Partial<NutrientData>;
  initialName?: string;
  /** Barcode from a scan whose lookup failed — kept so it can be retried. */
  failedBarcode?: string;
  customNutrients?: CustomNutrient[];
}

export function AddFoodModal({ open, onClose, onAdd, initialData, initialName, failedBarcode, customNutrients = [] }: AddFoodModalProps) {
  const [name, setName] = useState(initialName || '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [nutrients, setNutrients] = useState<NutrientData>(initialData || {});
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['macros']);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mealFileRef = useRef<HTMLInputElement>(null);
  const [mealOpen, setMealOpen] = useState(false);
  const [mealText, setMealText] = useState('');
  const [mealPhoto, setMealPhoto] = useState<File | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [mealInfo, setMealInfo] = useState<{ items: string[]; confidence: string } | null>(null);

  useEffect(() => {
    if (open && failedBarcode) {
      setBarcode(failedBarcode);
      setLookupFailed(true);
    }
    if (!open) {
      setLookupFailed(false);
      setMealOpen(false); setMealText(''); setMealPhoto(null); setMealInfo(null);
    }
  }, [open, failedBarcode]);

  const applyResult = (r: { name?: string | null; brand?: string | null; servingSize?: number | null; servingUnit?: string | null; nutrients: NutrientData }) => {
    if (r.name && !name.trim()) setName(r.name);
    if (r.brand && !brand.trim()) setBrand(r.brand);
    if (r.servingSize) setServingSize(String(r.servingSize));
    if (r.servingUnit) setServingUnit(r.servingUnit);
    setNutrients(prev => ({ ...prev, ...r.nutrients }));
    const cats = Object.entries(NUTRIENT_CATEGORIES)
      .filter(([, keys]) => (keys as readonly string[]).some(k => r.nutrients[k] !== undefined))
      .map(([c]) => c);
    setExpandedCategories(prev => Array.from(new Set([...prev, ...cats])));
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setScanning(true);
    try {
      const fields: Record<string, string> = {};
      Object.values(NUTRIENT_CATEGORIES).flat().forEach(k => { fields[k] = NUTRIENT_UNITS[k] ?? 'g'; });
      const res = await readNutritionLabel(file, fields);
      applyResult(res);
      toast.success(`Read ${Object.keys(res.nutrients).length} values from the label — please double-check them`);
      if (res.notes) toast.message(res.notes);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onEstimate = async () => {
    setEstimating(true);
    try {
      const fields: Record<string, string> = {};
      Object.values(NUTRIENT_CATEGORIES).flat().forEach(k => { fields[k] = NUTRIENT_UNITS[k] ?? 'g'; });
      const res = await estimateMeal(mealText, mealPhoto, fields);
      applyResult(res);
      setMealInfo({ items: res.items ?? [], confidence: res.confidence });
      toast.success('Meal estimated — please double-check the values');
      if (res.notes) toast.message(res.notes);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEstimating(false);
    }
  };

  const onRetry = async () => {
    const code = barcode.trim();
    if (!code) return;
    setRetrying(true);
    try {
      const res = await retryBarcodeLookup(code);
      if (res) {
        applyResult(res);
        setLookupFailed(false);
        toast.success('Found it — details filled in');
      } else {
        toast.error('Still not found. Enter the details or photograph the label.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRetrying(false);
    }
  };

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
          <DialogDescription className="sr-only">Add a new food item to your database</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[55vh] px-6">
            <div className="space-y-5 pb-4">
              {lookupFailed && barcode.trim() && (
                <div className="rounded-2xl bg-secondary p-3 flex items-center gap-3">
                  <ScanBarcode className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Barcode not found</p>
                    <p className="text-xs text-muted-foreground truncate">{barcode} is kept — fill in the rest or try again.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={retrying} className="rounded-full shrink-0">
                    {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCw className="h-4 w-4 mr-1" />Retry</>}
                  </Button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => onPhoto(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={scanning}
                className="w-full h-12 rounded-xl"
              >
                {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reading label…</> : <><Camera className="h-4 w-4 mr-2" />Photograph nutrition label</>}
              </Button>
              {!mealOpen ? (
                <Button type="button" variant="outline" onClick={() => setMealOpen(true)} className="w-full h-12 rounded-xl">
                  <Sparkles className="h-4 w-4 mr-2" />Estimate a meal with AI
                </Button>
              ) : (
                <div className="rounded-2xl bg-secondary p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Estimate a meal</p>
                    <button type="button" onClick={() => setMealOpen(false)} className="text-xs text-muted-foreground">Close</button>
                  </div>
                  <Textarea
                    value={mealText}
                    onChange={e => setMealText(e.target.value.slice(0, 1000))}
                    placeholder="e.g. Plate of spaghetti bolognese with parmesan, about a fist of pasta"
                    className="bg-background border-0 rounded-xl min-h-[72px]"
                  />
                  <input ref={mealFileRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => setMealPhoto(e.target.files?.[0] ?? null)} />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-full flex-1 min-w-0" onClick={() => mealFileRef.current?.click()}>
                      <ImagePlus className="h-4 w-4 mr-1 shrink-0" /><span className="truncate">{mealPhoto ? mealPhoto.name : 'Add photo'}</span>
                    </Button>
                    {mealPhoto && (
                      <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => { setMealPhoto(null); if (mealFileRef.current) mealFileRef.current.value = ''; }}>Remove</Button>
                    )}
                  </div>
                  <Button type="button" onClick={onEstimate} disabled={estimating || (!mealPhoto && mealText.trim().length < 3)} className="w-full rounded-xl">
                    {estimating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Estimating…</> : 'Estimate serving & nutrients'}
                  </Button>
                  {mealInfo && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Confidence: <span className="font-medium text-foreground">{mealInfo.confidence}</span></p>
                      {mealInfo.items.length > 0 && <p>{mealInfo.items.join(' · ')}</p>}
                      <p>Values below are per 100 g; serving size is the whole meal. Check and edit before saving.</p>
                    </div>
                  )}
                </div>
              )}

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
