import { useState, useRef } from 'react';
import { Plus, Sparkles, Apple, Settings } from 'lucide-react';
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
import { FoodItem, NutrientData } from '@/types/nutrients';

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
    getTodayLog,
    getTodayNutrients,
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
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);

  const todayNutrients = getTodayNutrients();
  const todayLog = getTodayLog();
  const { dailyGoals } = settings;

  const calorieGoal = dailyGoals['energy-kcal'] || 2000;
  const currentCalories = todayNutrients['energy-kcal'] || 0;
  const caloriePercentage = Math.round((currentCalories / calorieGoal) * 100);

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

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = importDatabase(event.target?.result as string);
      toast({
        title: result.success ? 'Imported' : 'Error',
        description: result.success ? 'Database restored' : result.errorMessage || 'Invalid file',
        variant: result.success ? 'default' : 'destructive',
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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

            {/* Action Buttons */}
            <section className="flex gap-3 px-1">
              <Button 
                onClick={() => setShowAddFood(true)} 
                className="flex-1 ios-button-secondary h-14 text-base"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Food
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

            {/* Nutrients Summary with Show More */}
            <NutrientsSummary 
              todayNutrients={todayNutrients}
              dailyGoals={dailyGoals}
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
            onLogFood={handleQuickAdd}
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
            <Button 
              onClick={() => setShowSettings(true)} 
              className="w-full ios-button-secondary h-14 justify-start px-4"
            >
              <Settings className="h-5 w-5 mr-3" />
              Daily Goals & Settings
            </Button>
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
    <div className="min-h-screen bg-background">
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
    </div>
  );
}
