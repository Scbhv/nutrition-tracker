import { useState, useRef, useCallback } from 'react';
import { Plus, Sparkles, Apple, Settings, Flame, Trash2, Clock, Dumbbell, Upload, Heart, ExternalLink } from 'lucide-react';
import { useAppearance } from '@/hooks/useAppearance';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFoodDatabase } from '@/hooks/useFoodDatabase';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { ProgressRing } from '@/components/ProgressRing';
import { MacroCard } from '@/components/MacroCard';
import { WeekView } from '@/components/WeekView';
import { SwipeableFoodEntry } from '@/components/SwipeableFoodEntry';
import { QuickAddPanel } from '@/components/QuickAddPanel';
import { NutrientsSummary } from '@/components/NutrientsSummary';
import { FoodDatabaseView } from '@/components/FoodDatabaseView';
import { AddFoodModal } from '@/components/AddFoodModal';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { AILookupModal } from '@/components/AILookupModal';
import { SettingsModal } from '@/components/SettingsModal';
import { TrendsView } from '@/components/TrendsView';
import { AppearanceSettings } from '@/components/AppearanceSettings';
import { AddExerciseModal } from '@/components/AddExerciseModal';
import { HealthKitExport } from '@/components/HealthKitExport';
import { FoodItem, NutrientData, NUTRIENT_UNITS } from '@/types/nutrients';

type Tab = 'today' | 'database' | 'trends' | 'profile';

export default function Index() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { appearance, updateAppearance } = useAppearance();
  const {
    foods,
    logs,
    settings,
    isLoading,
    addFood,
    deleteFood,
    getFoodByBarcode,
    addFoodEntry,
    removeFoodEntry,
    addExerciseEntry,
    removeExerciseEntry,
    getTodayLog,
    getTodayNutrients,
    getTodayBurnedCalories,
    getGoalsForDate,
    exportDatabase,
    importDatabase,
    updateSettings,
    mergeFoods,
  } = useFoodDatabase();

  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [showAddFood, setShowAddFood] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showAILookup, setShowAILookup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const todayNutrients = getTodayNutrients();
  const todayLog = getTodayLog();
  const dailyGoals = getGoalsForDate();
  const burnedCalories = getTodayBurnedCalories();

  const calorieGoal = dailyGoals['energy-kcal'] || 2000;
  const currentCalories = todayNutrients['energy-kcal'] || 0;
  const netCalories = currentCalories - burnedCalories;
  const caloriePercentage = Math.round((currentCalories / calorieGoal) * 100);
  const netPercentage = Math.round((netCalories / calorieGoal) * 100);

  const handleBarcodeScan = (barcode: string) => {
    const existingFood = getFoodByBarcode(barcode);
    if (existingFood) {
      addFoodEntry(existingFood.id);
      toast({
        title: 'Food logged',
        description: `Added ${existingFood.name}`,
      });
    } else {
      toast({
        title: 'Not found',
        description: `Barcode ${barcode} not in database`,
        variant: 'destructive',
      });
      setShowAddFood(true);
    }
  };

  const handleExport = () => {
    const data = exportDatabase();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutritrack-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Database downloaded' });
  };

  const handleImport = () => fileInputRef.current?.click();

  // Convert grams to the app's expected unit for a nutrient key
  const convertFromGrams = (key: string, valueInGrams: number): number => {
    const unit = NUTRIENT_UNITS[key];
    if (!unit) return valueInGrams;
    if (unit === 'mg') return Math.round(valueInGrams * 1000 * 100) / 100;
    if (unit === 'μg') return Math.round(valueInGrams * 1_000_000 * 100) / 100;
    // kcal, g, ml — no conversion
    return Math.round(valueInGrams * 100) / 100;
  };

  // Detect flat nutrient JSON (keys ending in _100g)
  const isFlatNutrientJSON = (obj: any): boolean => {
    if (typeof obj !== 'object' || Array.isArray(obj)) return false;
    return Object.keys(obj).some(k => k.endsWith('_100g'));
  };

  const importFlatNutrientJSON = (parsed: Record<string, number>, fileName: string) => {
    const nutrients: NutrientData = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'number') continue;
      const nutrientKey = key.replace(/_100g$/, '');
      // energy-kcal stays in kcal, macros in g — only convert minerals/vitamins
      if (nutrientKey === 'energy-kcal') {
        nutrients[nutrientKey] = Math.round(value * 100) / 100;
      } else {
        nutrients[nutrientKey] = convertFromGrams(nutrientKey, value);
      }
    }

    const foodName = fileName.replace(/\.json$/i, '').replace(/[_-]/g, ' ').trim() || 'Imported Food';
    const now = new Date().toISOString();
    const newFood: FoodItem = {
      id: crypto.randomUUID(),
      name: foodName.charAt(0).toUpperCase() + foodName.slice(1),
      servingSize: 100,
      servingUnit: 'g',
      nutrients,
      createdAt: now,
      updatedAt: now,
    };

    mergeFoods([newFood]);
    toast({
      title: 'Food Imported',
      description: `"${newFood.name}" added to your database`,
    });
  };

  const processJsonFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      toast({ title: 'Error', description: 'Only .json files are supported', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonString = event.target?.result as string;
        const parsed = JSON.parse(jsonString);
        if (isFlatNutrientJSON(parsed)) {
          importFlatNutrientJSON(parsed, file.name);
        } else {
          const result = importDatabase(jsonString);
          toast({
            title: result.success ? 'Imported' : 'Error',
            description: result.success ? 'Database restored' : result.errorMessage || 'Invalid file',
            variant: result.success ? 'default' : 'destructive',
          });
        }
      } catch {
        toast({ title: 'Error', description: 'Invalid JSON file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  }, [importDatabase, mergeFoods, toast]);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processJsonFile(file);
    e.target.value = '';
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items?.length) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) processJsonFile(file);
  }, [processJsonFile]);

  const handleImportFoods = (newFoods: FoodItem[]) => {
    mergeFoods(newFoods);
    toast({
      title: 'Imported',
      description: `Added ${newFoods.length} foods from file`,
    });
  };

  const handleQuickAdd = (foodId: string) => {
    const food = foods.find(f => f.id === foodId);
    if (food) {
      addFoodEntry(foodId);
      toast({ title: 'Added', description: food.name });
    }
  };

  const handleAddFood = (foodData: { name: string; barcode?: string; brand?: string; servingSize: number; servingUnit: string; nutrients: NutrientData }) => {
    addFood(foodData);
    toast({ title: 'Saved', description: foodData.name });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'today':
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Main Progress Ring */}
            <section className="flex flex-col items-center py-6">
              <ProgressRing
                progress={caloriePercentage}
                size={240}
                strokeWidth={14}
                label="Calories"
                value={`${caloriePercentage}%`}
                sublabel={caloriePercentage >= 100 ? 'Complete' : `${Math.round(calorieGoal - currentCalories)} left`}
              />
              <p className="text-muted-foreground text-sm mt-4">
                {currentCalories.toFixed(0)} / {calorieGoal} kcal
              </p>
            </section>

            {/* Net Calorie Summary */}
            {burnedCalories > 0 && (
              <section className="glass-card rounded-2xl p-4 animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-sm text-foreground">Net Calories</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{currentCalories.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Eaten</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-destructive">−{burnedCalories.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Burned</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${netCalories < 0 ? 'text-destructive' : 'text-primary'}`}>
                      {netCalories.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Net</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, netPercentage))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-1.5">
                  {netCalories > 0
                    ? `${Math.round(calorieGoal - netCalories)} net kcal remaining`
                    : 'Calorie deficit — you burned more than you ate'}
                </p>
              </section>
            )}

            {/* Action Buttons */}
            <section className="flex gap-2 px-1">
              <Button 
                onClick={() => setShowAddFood(true)} 
                className="flex-1 ios-button-secondary h-14 text-base"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Food
              </Button>
              <Button 
                onClick={() => setShowAddExercise(true)} 
                className="flex-[0.8] ios-button-secondary h-14 text-base"
              >
                <Flame className="h-5 w-5 mr-2" />
                Burn
              </Button>
              <Button 
                onClick={() => setShowAILookup(true)} 
                className="flex-1 ios-button-accent h-14 text-base"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Generate
              </Button>
            </section>

            {/* Week View */}
            <WeekView />

            {/* Macros Grid */}
            <section className="grid grid-cols-2 gap-3">
              <MacroCard
                label="Protein"
                value={todayNutrients['proteins'] || 0}
                unit="g"
                goal={dailyGoals['proteins'] || 50}
                color="bg-nutrient-protein"
                icon
              />
              <MacroCard
                label="Carbs"
                value={todayNutrients['carbohydrates'] || 0}
                unit="g"
                goal={dailyGoals['carbohydrates'] || 300}
                color="bg-nutrient-carbs"
                icon
              />
              <MacroCard
                label="Fat"
                value={todayNutrients['fat'] || 0}
                unit="g"
                goal={dailyGoals['fat'] || 65}
                color="bg-nutrient-fat"
                icon
              />
              <MacroCard
                label="Fiber"
                value={todayNutrients['fiber'] || 0}
                unit="g"
                goal={dailyGoals['fiber'] || 25}
                color="bg-nutrient-fiber"
                icon
              />
            </section>

            {/* Today's Food */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground px-1">Today's Food</h2>
              
              {todayLog.entries.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground">
                  <Apple className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No food logged yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayLog.entries.map(entry => {
                    const food = foods.find(f => f.id === entry.foodId);
                    if (!food) return null;
                    return (
                      <SwipeableFoodEntry
                        key={entry.id}
                        food={food}
                        entry={entry}
                        onRemove={() => removeFoodEntry(todayLog.date, entry.id)}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* Today's Exercise */}
            {(todayLog.exerciseEntries || []).length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Flame className="h-5 w-5 text-destructive" />
                    Exercise
                  </h2>
                  <button
                    onClick={() => setShowAddExercise(true)}
                    className="text-sm text-primary font-medium"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(todayLog.exerciseEntries || []).map(entry => (
                    <div key={entry.id} className="glass-card rounded-2xl p-4 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-destructive/15 text-destructive">
                          <Dumbbell className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.caloriesBurned} kcal burned
                            {entry.durationMinutes ? ` • ${entry.durationMinutes} min` : ''}
                            {' • '}
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeExerciseEntry(todayLog.date, entry.id)}
                        className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Nutrients Summary with Show More */}
            <NutrientsSummary 
              todayNutrients={todayNutrients}
              dailyGoals={dailyGoals}
              customNutrients={settings.customNutrients}
            />

            {/* Quick Add */}
            <QuickAddPanel foods={foods} onSelect={handleQuickAdd} />
          </div>
        );

      case 'database':
        return (
          <FoodDatabaseView
            foods={foods}
            logs={logs}
            settings={settings}
            onAddFood={() => setShowAddFood(true)}
            onEditFood={(food) => {
              setEditingFood(food);
              setShowAddFood(true);
            }}
            onDeleteFood={(id) => {
              deleteFood(id);
              toast({ title: 'Deleted' });
            }}
            onLogFood={(foodId, portionGrams) => {
              const food = foods.find(f => f.id === foodId);
              if (food) {
                const servingAmount = portionGrams / food.servingSize;
                addFoodEntry(foodId, servingAmount);
                toast({ title: 'Added', description: `${food.name} — ${portionGrams}g` });
              }
            }}
            onExport={handleExport}
            onImport={handleImport}
            onImportFoods={handleImportFoods}
          />
        );

      case 'trends':
        return (
          <TrendsView
            foods={foods}
            logs={logs}
            dailyGoals={dailyGoals}
          />
        );

      case 'profile':
        return (
          <div className="space-y-4 animate-fade-in">
            <AppearanceSettings
              appearance={appearance}
              onUpdate={updateAppearance}
            />
            <Button 
              onClick={() => setShowSettings(true)} 
              className="w-full ios-button-secondary h-14 justify-start px-4"
            >
              <Settings className="h-5 w-5 mr-3" />
              Daily Goals & Settings
            </Button>
            <HealthKitExport
              foods={foods}
              logs={logs}
              getTodayNutrients={getTodayNutrients}
            />
            <Button 
              onClick={handleExport} 
              className="w-full ios-button-secondary h-14 justify-start px-4"
            >
              Export Database (JSON)
            </Button>
            <Button 
              onClick={handleImport} 
              className="w-full ios-button-secondary h-14 justify-start px-4"
            >
              Import Database
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'today': return 'Nutrition';
      case 'database': return 'Foods';
      case 'trends': return 'Trends';
      case 'profile': return 'Profile';
      default: return 'NutriTrack';
    }
  };

  return (
    <div
      className="min-h-screen bg-background relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-primary rounded-3xl p-12 text-center animate-scale-in">
            <Upload className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-xl font-semibold text-foreground">Drop JSON file to import</p>
            <p className="text-sm text-muted-foreground mt-2">Food nutrients or full database export</p>
          </div>
        </div>
      )}
      <Header 
        title={getTitle()} 
        onSettingsClick={activeTab === 'today' ? () => setShowSettings(true) : undefined}
        onAddClick={activeTab === 'today' ? () => setShowAddFood(true) : undefined}
      />

      <ScrollArea className="h-[calc(100vh-140px)]">
        <main className="container mx-auto px-5 pb-6 safe-bottom">
          {renderContent()}
        </main>
      </ScrollArea>

      <BottomNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onAddFood={() => setShowAddFood(true)}
        onScanBarcode={() => setShowScanner(true)}
        onAILookup={() => setShowAILookup(true)}
        onImport={handleImport}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Modals */}
      <AddFoodModal
        open={showAddFood}
        onClose={() => {
          setShowAddFood(false);
          setEditingFood(null);
        }}
        onAdd={handleAddFood}
        initialData={editingFood?.nutrients}
        initialName={editingFood?.name}
        customNutrients={settings.customNutrients}
      />

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      <AILookupModal
        open={showAILookup}
        onClose={() => setShowAILookup(false)}
        onResult={(data) => {
          addFood({ ...data, servingSize: 100, servingUnit: 'g' });
          setShowAILookup(false);
        }}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={updateSettings}
      />

      <AddExerciseModal
        open={showAddExercise}
        onClose={() => setShowAddExercise(false)}
        onAdd={(name, cals, duration) => {
          addExerciseEntry(name, cals, duration);
          toast({ title: 'Logged', description: `${name} — ${cals} kcal burned` });
          setShowAddExercise(false);
        }}
      />
    </div>
  );
}
