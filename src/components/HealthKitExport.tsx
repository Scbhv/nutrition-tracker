import { useState } from 'react';
import { Heart, Copy, Check, Download, Calendar, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { NutrientData, FoodItem, DailyLog } from '@/types/nutrients';
import { cn } from '@/lib/utils';

/**
 * Maps internal nutrient keys → Apple HealthKit HKQuantityTypeIdentifier names
 * and the unit HealthKit expects.
 */
const HEALTHKIT_MAP: Record<string, { identifier: string; unit: string; label: string }> = {
  'energy-kcal': { identifier: 'dietaryEnergyConsumed', unit: 'kcal', label: 'Calories' },
  'proteins':    { identifier: 'dietaryProtein', unit: 'g', label: 'Protein' },
  'fat':         { identifier: 'dietaryFatTotal', unit: 'g', label: 'Total Fat' },
  'saturated-fat': { identifier: 'dietaryFatSaturated', unit: 'g', label: 'Saturated Fat' },
  'unsaturated-fat': { identifier: 'dietaryFatMonounsaturated', unit: 'g', label: 'Unsaturated Fat' },
  'carbohydrates': { identifier: 'dietaryCarbohydrates', unit: 'g', label: 'Carbs' },
  'sugars':      { identifier: 'dietarySugar', unit: 'g', label: 'Sugar' },
  'fiber':       { identifier: 'dietaryFiber', unit: 'g', label: 'Fiber' },
  'sodium':      { identifier: 'dietarySodium', unit: 'mg', label: 'Sodium' },
  'potassium':   { identifier: 'dietaryPotassium', unit: 'mg', label: 'Potassium' },
  'calcium':     { identifier: 'dietaryCalcium', unit: 'mg', label: 'Calcium' },
  'magnesium':   { identifier: 'dietaryMagnesium', unit: 'mg', label: 'Magnesium' },
  'iron':        { identifier: 'dietaryIron', unit: 'mg', label: 'Iron' },
  'zinc':        { identifier: 'dietaryZinc', unit: 'mg', label: 'Zinc' },
  'copper':      { identifier: 'dietaryCopper', unit: 'mg', label: 'Copper' },
  'manganese':   { identifier: 'dietaryManganese', unit: 'mg', label: 'Manganese' },
  'phosphorus':  { identifier: 'dietaryPhosphorus', unit: 'mg', label: 'Phosphorus' },
  'vitamin-a':   { identifier: 'dietaryVitaminA', unit: 'mcg', label: 'Vitamin A' },
  'vitamin-c':   { identifier: 'dietaryVitaminC', unit: 'mg', label: 'Vitamin C' },
  'vitamin-d':   { identifier: 'dietaryVitaminD', unit: 'mcg', label: 'Vitamin D' },
  'vitamin-e':   { identifier: 'dietaryVitaminE', unit: 'mg', label: 'Vitamin E' },
  'vitamin-k':   { identifier: 'dietaryVitaminK', unit: 'mcg', label: 'Vitamin K' },
  'vitamin-b1':  { identifier: 'dietaryThiamin', unit: 'mg', label: 'Vitamin B1' },
  'vitamin-b2':  { identifier: 'dietaryRiboflavin', unit: 'mg', label: 'Vitamin B2' },
  'vitamin-b3':  { identifier: 'dietaryNiacin', unit: 'mg', label: 'Vitamin B3' },
  'vitamin-b6':  { identifier: 'dietaryVitaminB6', unit: 'mg', label: 'Vitamin B6' },
  'vitamin-b12': { identifier: 'dietaryVitaminB12', unit: 'mcg', label: 'Vitamin B12' },
  'folate':      { identifier: 'dietaryFolate', unit: 'mcg', label: 'Folate' },
  'water':       { identifier: 'dietaryWater', unit: 'mL', label: 'Water' },
  'caffeine':    { identifier: 'dietaryCaffeine', unit: 'mg', label: 'Caffeine' },
};

interface HealthKitExportProps {
  foods: FoodItem[];
  logs: DailyLog[];
  getTodayNutrients: () => NutrientData;
}

function getNutrientsForDate(date: string, logs: DailyLog[], foods: FoodItem[]): NutrientData {
  const log = logs.find(l => l.date === date);
  if (!log) return {};
  const totals: NutrientData = {};
  log.entries.forEach(entry => {
    const food = foods.find(f => f.id === entry.foodId);
    if (food) {
      const multiplier = (entry.servingAmount * food.servingSize) / 100;
      Object.entries(food.nutrients).forEach(([key, value]) => {
        if (typeof value === 'number') {
          totals[key] = (totals[key] || 0) + value * multiplier;
        }
      });
    }
  });
  return totals;
}

function buildHealthKitPayload(
  nutrients: NutrientData,
  date: string,
  enabledNutrients: Record<string, boolean>
) {
  const samples: Array<{
    sampleType: string;
    value: number;
    unit: string;
    startDate: string;
    endDate: string;
    metadata: { source: string };
  }> = [];

  for (const [key, mapping] of Object.entries(HEALTHKIT_MAP)) {
    if (!enabledNutrients[key]) continue;
    const value = nutrients[key];
    if (typeof value !== 'number' || value <= 0) continue;

    // Convert water from ml/g to mL if needed
    const finalValue = key === 'water' ? value : value;

    samples.push({
      sampleType: `HKQuantityTypeIdentifier${mapping.identifier.charAt(0).toUpperCase()}${mapping.identifier.slice(1)}`,
      value: Math.round(finalValue * 100) / 100,
      unit: mapping.unit,
      startDate: `${date}T12:00:00Z`,
      endDate: `${date}T12:00:00Z`,
      metadata: { source: 'NutriTrack' },
    });
  }

  return {
    version: 1,
    source: 'NutriTrack',
    exportDate: new Date().toISOString(),
    date,
    samples,
  };
}

export function HealthKitExport({ foods, logs, getTodayNutrients }: HealthKitExportProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [exportDate, setExportDate] = useState(new Date().toISOString().split('T')[0]);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // All nutrients enabled by default
  const [enabledNutrients, setEnabledNutrients] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const key of Object.keys(HEALTHKIT_MAP)) {
      defaults[key] = true;
    }
    return defaults;
  });

  const isToday = exportDate === new Date().toISOString().split('T')[0];
  const nutrients = isToday
    ? getTodayNutrients()
    : getNutrientsForDate(exportDate, logs, foods);

  const payload = buildHealthKitPayload(nutrients, exportDate, enabledNutrients);
  const enabledCount = Object.values(enabledNutrients).filter(Boolean).length;
  const samplesWithData = payload.samples.length;

  const handleCopyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      toast({ title: 'Copied', description: 'Health data JSON copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'Could not copy to clipboard', variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutritrack-health-${exportDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: `Health export for ${exportDate}` });
  };

  const toggleNutrient = (key: string) => {
    setEnabledNutrients(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = (enabled: boolean) => {
    const next: Record<string, boolean> = {};
    for (const key of Object.keys(HEALTHKIT_MAP)) {
      next[key] = enabled;
    }
    setEnabledNutrients(next);
  };

  // Group nutrients by category for display
  const categories = [
    { label: 'Energy & Macros', keys: ['energy-kcal', 'proteins', 'fat', 'saturated-fat', 'unsaturated-fat', 'carbohydrates', 'sugars', 'fiber'] },
    { label: 'Minerals', keys: ['sodium', 'potassium', 'calcium', 'magnesium', 'iron', 'zinc', 'copper', 'manganese', 'phosphorus'] },
    { label: 'Vitamins', keys: ['vitamin-a', 'vitamin-c', 'vitamin-d', 'vitamin-e', 'vitamin-k', 'vitamin-b1', 'vitamin-b2', 'vitamin-b3', 'vitamin-b6', 'vitamin-b12', 'folate'] },
    { label: 'Other', keys: ['water', 'caffeine'] },
  ];

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full ios-button-secondary h-14 justify-start px-4"
      >
        <Heart className="h-5 w-5 mr-3 text-destructive" />
        Apple Health Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] p-0 gap-0 bg-card border-border rounded-3xl">
          <DialogHeader className="p-6 pb-3">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive" />
              Health Export
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Export nutrition data for Apple Shortcuts to sync with Apple Health
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[55vh] px-6">
            <div className="space-y-5 pb-4">
              {/* Date Picker */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Export Date</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={exportDate}
                    onChange={e => setExportDate(e.target.value)}
                    className="bg-secondary border-0 rounded-xl"
                  />
                </div>
              </div>

              {/* Summary Card */}
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-foreground">Data Summary</h3>
                  <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-secondary">
                    {samplesWithData} samples
                  </span>
                </div>

                {samplesWithData === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No nutrition data for this date
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {payload.samples.slice(0, 6).map(sample => {
                      const entry = Object.entries(HEALTHKIT_MAP).find(
                        ([, m]) => `HKQuantityTypeIdentifier${m.identifier.charAt(0).toUpperCase()}${m.identifier.slice(1)}` === sample.sampleType
                      );
                      return (
                        <div key={sample.sampleType} className="flex justify-between py-1.5 px-2 rounded-lg bg-secondary/50">
                          <span className="text-xs text-muted-foreground">{entry?.[1]?.label || '?'}</span>
                          <span className="text-xs font-semibold text-foreground">
                            {sample.value} {sample.unit}
                          </span>
                        </div>
                      );
                    })}
                    {samplesWithData > 6 && (
                      <p className="col-span-2 text-xs text-muted-foreground text-center pt-1">
                        +{samplesWithData - 6} more
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Nutrient Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
                  >
                    Select Nutrients
                    {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <span className="text-xs text-muted-foreground">{enabledCount} selected</span>
                </div>

                {showDetails && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAll(true)}
                        className="h-7 text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAll(false)}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        Clear All
                      </Button>
                    </div>

                    {categories.map(cat => (
                      <div key={cat.label} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {cat.label}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {cat.keys.map(key => {
                            const mapping = HEALTHKIT_MAP[key];
                            if (!mapping) return null;
                            const value = nutrients[key];
                            const hasData = typeof value === 'number' && value > 0;
                            return (
                              <button
                                key={key}
                                onClick={() => toggleNutrient(key)}
                                className={cn(
                                  "flex items-center justify-between py-2 px-3 rounded-xl text-xs transition-all",
                                  enabledNutrients[key]
                                    ? "bg-primary/15 text-foreground"
                                    : "bg-secondary text-muted-foreground"
                                )}
                              >
                                <span className="truncate">{mapping.label}</span>
                                {hasData && (
                                  <span className="text-[10px] opacity-60 ml-1">
                                    {Math.round((value as number) * 10) / 10}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="glass-card rounded-2xl p-4 space-y-2">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How to Use
                </h3>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Copy or download the JSON export below</li>
                  <li>Open the <strong>Shortcuts</strong> app on your iPhone</li>
                  <li>Create a shortcut that reads the JSON file</li>
                  <li>Use "Log Health Sample" actions for each nutrient</li>
                  <li>Run the shortcut to sync data to Apple Health</li>
                </ol>
                <p className="text-[10px] text-muted-foreground/70 pt-1">
                  Tip: Use "Get Contents of URL" pointing to your exported file, then parse each sample with "Repeat with Each"
                </p>
              </div>
            </div>
          </ScrollArea>

          <div className="flex gap-3 p-6 pt-4">
            <Button
              onClick={handleCopyJSON}
              className="flex-1 ios-button-secondary"
              disabled={samplesWithData === 0}
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </Button>
            <Button
              onClick={handleDownload}
              className="flex-1 ios-button-primary"
              disabled={samplesWithData === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
