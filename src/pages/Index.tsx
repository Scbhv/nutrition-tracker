import { useState, useRef } from 'react';
import { Flame, Beef, Wheat, Droplets, Plus, Scan, Sparkles, Database, Apple } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFoodDatabase } from '@/hooks/useFoodDatabase';
import { Header } from '@/components/Header';
import { MacroCard } from '@/components/MacroCard';
import { NutrientBar } from '@/components/NutrientBar';
import { FoodEntryCard } from '@/components/FoodEntryCard';
import { QuickAddPanel } from '@/components/QuickAddPanel';
import { FoodDatabaseView } from '@/components/FoodDatabaseView';
import { AddFoodModal } from '@/components/AddFoodModal';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { AILookupModal } from '@/components/AILookupModal';
import { SettingsModal } from '@/components/SettingsModal';
import { NUTRIENT_CATEGORIES, FoodItem, NutrientData } from '@/types/nutrients';

export default function Index() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    foods,
    settings,
    isLoading,
    addFood,
    updateFood,
    deleteFood,
    getFoodByBarcode,
    addFoodEntry,
    removeFoodEntry,
    getTodayLog,
    getTodayNutrients,
    exportDatabase,
    importDatabase,
    updateSettings,
  } = useFoodDatabase();

  const [showAddFood, setShowAddFood] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showAILookup, setShowAILookup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);

  const todayNutrients = getTodayNutrients();
  const todayLog = getTodayLog();
  const { dailyGoals } = settings;

  const handleBarcodeScan = (barcode: string) => {
    const existingFood = getFoodByBarcode(barcode);
    if (existingFood) {
      addFoodEntry(existingFood.id);
      toast({
        title: 'Food logged',
        description: `Added ${existingFood.name} to today's log`,
      });
    } else {
      toast({
        title: 'Food not found',
        description: `Barcode ${barcode} not in your database. Add it manually.`,
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
    a.download = `nutritrack-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Database exported',
      description: 'Your food database has been downloaded.',
    });
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importDatabase(content);
      if (success) {
        toast({
          title: 'Database imported',
          description: 'Your food database has been restored.',
        });
      } else {
        toast({
          title: 'Import failed',
          description: 'Could not parse the import file.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleQuickAdd = (foodId: string) => {
    const food = foods.find(f => f.id === foodId);
    if (food) {
      addFoodEntry(foodId);
      toast({
        title: 'Food logged',
        description: `Added ${food.name} to today's log`,
      });
    }
  };

  const handleAddFood = (foodData: { name: string; barcode?: string; brand?: string; servingSize: number; servingUnit: string; nutrients: NutrientData }) => {
    addFood(foodData);
    toast({
      title: 'Food added',
      description: `${foodData.name} has been added to your database.`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your nutrition data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onSettingsClick={() => setShowSettings(true)} />

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="today" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="today" className="flex items-center gap-2">
              <Apple className="h-4 w-4" />
              Today
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-6 animate-fade-in">
            {/* Macro Overview */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MacroCard
                label="Calories"
                value={todayNutrients['energy-kcal'] || 0}
                unit="kcal"
                goal={dailyGoals['energy-kcal'] || 2000}
                icon={<Flame className="h-5 w-5 text-nutrient-energy" />}
                colorClass="bg-nutrient-energy"
              />
              <MacroCard
                label="Protein"
                value={todayNutrients['proteins'] || 0}
                unit="g"
                goal={dailyGoals['proteins'] || 50}
                icon={<Beef className="h-5 w-5 text-nutrient-protein" />}
                colorClass="bg-nutrient-protein"
              />
              <MacroCard
                label="Carbs"
                value={todayNutrients['carbohydrates'] || 0}
                unit="g"
                goal={dailyGoals['carbohydrates'] || 300}
                icon={<Wheat className="h-5 w-5 text-nutrient-carbs" />}
                colorClass="bg-nutrient-carbs"
              />
              <MacroCard
                label="Fat"
                value={todayNutrients['fat'] || 0}
                unit="g"
                goal={dailyGoals['fat'] || 65}
                icon={<Droplets className="h-5 w-5 text-nutrient-fat" />}
                colorClass="bg-nutrient-fat"
              />
            </section>

            {/* Action Buttons */}
            <section className="flex flex-wrap gap-3">
              <Button onClick={() => setShowAddFood(true)} className="flex-1 sm:flex-none">
                <Plus className="h-4 w-4 mr-2" />
                Add Food
              </Button>
              <Button variant="outline" onClick={() => setShowScanner(true)} className="flex-1 sm:flex-none">
                <Scan className="h-4 w-4 mr-2" />
                Scan Barcode
              </Button>
              <Button variant="outline" onClick={() => setShowAILookup(true)} className="flex-1 sm:flex-none">
                <Sparkles className="h-4 w-4 mr-2" />
                AI Lookup
              </Button>
            </section>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Today's Log */}
              <section className="lg:col-span-2 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Today's Food</h2>
                
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {todayLog.entries.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Apple className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No food logged today.</p>
                        <p className="text-sm mt-1">Add your first meal to start tracking!</p>
                      </div>
                    ) : (
                      todayLog.entries.map(entry => {
                        const food = foods.find(f => f.id === entry.foodId);
                        if (!food) return null;
                        return (
                          <FoodEntryCard
                            key={entry.id}
                            food={food}
                            entry={entry}
                            onRemove={() => removeFoodEntry(todayLog.date, entry.id)}
                          />
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </section>

              {/* Quick Add & Other Nutrients */}
              <aside className="space-y-6">
                <QuickAddPanel foods={foods} onSelect={handleQuickAdd} />

                {/* Additional Nutrients */}
                <div className="glass-card rounded-xl p-4 space-y-4">
                  <h3 className="font-semibold text-foreground">Minerals & Vitamins</h3>
                  <div className="space-y-3">
                    <NutrientBar
                      nutrient="vitamin-c"
                      current={todayNutrients['vitamin-c'] || 0}
                      goal={dailyGoals['vitamin-c'] || 90}
                      colorClass="bg-nutrient-vitamin"
                    />
                    <NutrientBar
                      nutrient="vitamin-d"
                      current={todayNutrients['vitamin-d'] || 0}
                      goal={dailyGoals['vitamin-d'] || 20}
                      colorClass="bg-nutrient-vitamin"
                    />
                    <NutrientBar
                      nutrient="calcium"
                      current={todayNutrients['calcium'] || 0}
                      goal={dailyGoals['calcium'] || 1000}
                      colorClass="bg-nutrient-mineral"
                    />
                    <NutrientBar
                      nutrient="iron"
                      current={todayNutrients['iron'] || 0}
                      goal={dailyGoals['iron'] || 18}
                      colorClass="bg-nutrient-mineral"
                    />
                    <NutrientBar
                      nutrient="water"
                      current={todayNutrients['water'] || 0}
                      goal={dailyGoals['water'] || 2500}
                      colorClass="bg-nutrient-water"
                    />
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="database" className="animate-fade-in">
            <FoodDatabaseView
              foods={foods}
              onAddFood={() => setShowAddFood(true)}
              onEditFood={(food) => {
                setEditingFood(food);
                setShowAddFood(true);
              }}
              onDeleteFood={(id) => {
                deleteFood(id);
                toast({
                  title: 'Food deleted',
                  description: 'The food has been removed from your database.',
                });
              }}
              onLogFood={handleQuickAdd}
              onExport={handleExport}
              onImport={handleImport}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Hidden file input for import */}
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
          addFood({
            ...data,
            servingSize: 100,
            servingUnit: 'g',
          });
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
