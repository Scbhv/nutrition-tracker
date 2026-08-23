import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Apple, Settings, Flame, Trash2, Clock, Dumbbell, Upload, Heart, ExternalLink, Lock, RotateCcw, Shield, Loader2, CheckCircle, LogOut, AlertTriangle, ClipboardCheck, User, Palette, Target, Database, LifeBuoy, Wrench, Search, X } from 'lucide-react';
import { HighlightText } from '@/components/HighlightText';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { usePremium } from '@/hooks/usePremium';
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
import { RecipeBuilderModal } from '@/components/RecipeBuilderModal';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { AILookupModal } from '@/components/AILookupModal';
import { SettingsModal } from '@/components/SettingsModal';
import { TrendsView } from '@/components/TrendsView';
import { AppearanceSettings } from '@/components/AppearanceSettings';
import { AddExerciseModal } from '@/components/AddExerciseModal';
import { HealthKitExport } from '@/components/HealthKitExport';
import { DonationGateModal } from '@/components/DonationGateModal';
import { BackupCard } from '@/components/BackupCard';
import { FeedbackCard } from '@/components/FeedbackCard';
import { OfflineSimulationCard } from '@/components/OfflineSimulationCard';
import { ErrorLogCard } from '@/components/ErrorLogCard';
import { ThemePackCard } from '@/components/ThemePackCard';
import { NutrientLibraryCard } from '@/components/NutrientLibraryCard';
import { SettingsSection } from '@/components/SettingsSection';
import { SettingsGroup } from '@/components/SettingsGroup';
import { useThemePack } from '@/hooks/useThemePack';
import { FoodItem, NutrientData, NUTRIENT_UNITS, Recipe } from '@/types/nutrients';
import { buildRecipeFoodFields } from '@/lib/recipe';

type Tab = 'today' | 'database' | 'trends' | 'profile';

export default function Index() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { appearance, updateAppearance } = useAppearance();
  useThemePack(); // applies persisted texture pack on mount
  const {
    foods,
    logs,
    settings,
    isLoading,
    addFood,
    updateFood,
    deleteFood,
    getFoodByBarcode,
    addFoodEntry,
    removeFoodEntry,
    updateFoodEntry,
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
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<FoodItem | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showAILookup, setShowAILookup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDonationGate, setShowDonationGate] = useState(false);
  const [settingsQuery, setSettingsQuery] = useState('');
  const { isPremium, recheck: recheckPremium } = usePremium();
  const aiLocked = !isPremium;
  const dragCounter = useRef(0);

  // Auth gate: redirect to /auth if not logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setIsLoggedIn(false); setAuthChecked(true); }
      else { setIsLoggedIn(true); setAuthChecked(true); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setAuthChecked(true);
      const email = session?.user?.email?.toLowerCase();
      setIsAdmin(!!email && ['simonstechprojects@gmail.com'].includes(email));
    });
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.toLowerCase();
      setIsAdmin(!!email && ['simonstechprojects@gmail.com'].includes(email));
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Auto-seed the starter food catalog on first launch (only when DB is empty).
  useEffect(() => {
    if (isLoading) return;
    if (foods.length > 0) return;
    if (localStorage.getItem('nutritrack-seed-loaded') === '1') return;
    import('@/data/seedFoods.json').then(mod => {
      const seed = (mod.default as { foods: any[] }).foods;
      const items = seed.map(f => ({
        ...f,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      mergeFoods(items as any);
      localStorage.setItem('nutritrack-seed-loaded', '1');
      toast({
        title: 'Starter foods loaded',
        description: `${items.length} common foods added to your library.`,
      });
    }).catch(() => {/* ignore */});
  }, [isLoading, foods.length, mergeFoods, toast]);

  const [signingOut, setSigningOut] = useState(false);
  const [restoringPurchase, setRestoringPurchase] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({ title: 'Signed out', description: 'See you soon.' });
      navigate('/auth');
    } catch (err) {
      toast({
        title: 'Could not sign out',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
      setSigningOut(false);
    }
  };

  const handleRestorePurchase = async () => {
    if (restoringPurchase) return;
    setRestoringPurchase(true);
    try {
      await recheckPremium();
      toast({
        title: isPremium ? 'Premium restored' : 'All set',
        description: isPremium
          ? 'Your premium status is active.'
          : 'No active premium found on this account.',
      });
    } finally {
      setTimeout(() => setRestoringPurchase(false), 400);
    }
  };

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
      <div className="min-h-svh bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderContent = () => {
    const q = settingsQuery.trim().toLowerCase();
    const settingsMatches = (...keywords: string[]) => {
      if (!q) return true;
      return keywords.some((k) => k.toLowerCase().includes(q));
    };

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

            {/* Week View — date context right under the ring */}
            <WeekView />

            {/* Net Calorie Summary */}
            {burnedCalories > 0 && (
              <section className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 border border-border/30 shadow-sm animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-[15px] text-foreground tracking-tight">Net Calories</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-semibold text-foreground tracking-tight">{currentCalories.toFixed(0)}</p>
                    <p className="text-[11px] text-muted-foreground/70">Eaten</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-destructive tracking-tight">−{burnedCalories.toFixed(0)}</p>
                    <p className="text-[11px] text-muted-foreground/70">Burned</p>
                  </div>
                  <div>
                    <p className={`text-lg font-semibold tracking-tight ${netCalories < 0 ? 'text-destructive' : 'text-primary'}`}>
                      {netCalories.toFixed(0)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">Net</p>
                  </div>
                </div>
                <div className="mt-3 h-[5px] rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, netPercentage))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/70 text-center mt-1.5">
                  {netCalories > 0
                    ? `${Math.round(calorieGoal - netCalories)} net kcal remaining`
                    : 'Calorie deficit — you burned more than you ate'}
                </p>
              </section>
            )}

            {/* Macros Grid — quick visual progress */}
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

            {/* Action Buttons — sit right above the log they create */}
            <section className="flex gap-2.5 px-1">
              <button 
                onClick={() => setShowAddFood(true)} 
                className="flex-1 h-12 rounded-[16px] bg-card/60 backdrop-blur-2xl border border-border/30 shadow-sm flex items-center justify-center gap-2 text-[14px] font-medium text-foreground tracking-tight active:scale-[0.97] transition-all"
              >
                <Plus className="h-[18px] w-[18px] text-primary" />
                Add Food
              </button>
              <button 
                onClick={() => setShowAddExercise(true)} 
                className="flex-[0.7] h-12 rounded-[16px] bg-card/60 backdrop-blur-2xl border border-border/30 shadow-sm flex items-center justify-center gap-2 text-[14px] font-medium text-foreground tracking-tight active:scale-[0.97] transition-all"
              >
                <Flame className="h-[18px] w-[18px] text-destructive" />
                Burn
              </button>
              <button 
                onClick={() => aiLocked ? setShowDonationGate(true) : setShowAILookup(true)} 
                className={`flex-1 h-12 rounded-[16px] bg-primary/15 backdrop-blur-2xl border border-primary/20 shadow-sm flex items-center justify-center gap-2 text-[14px] font-medium text-primary tracking-tight active:scale-[0.97] transition-all ${aiLocked ? 'opacity-40' : ''}`}
              >
                <Sparkles className="h-[18px] w-[18px]" />
                Generate
              </button>
            </section>

            {/* Today's Food */}
            <section className="space-y-3">
              <h2 className="text-[17px] font-semibold text-foreground px-1 tracking-tight">Today's Food</h2>
              
              {todayLog.entries.length === 0 ? (
                <div className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-8 text-center text-muted-foreground/70 border border-border/30 shadow-sm">
                  <Apple className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-[14px]">No food logged yet</p>
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
                        onUpdatePortion={(grams) => {
                          const newServingAmount = grams / food.servingSize;
                          updateFoodEntry(todayLog.date, entry.id, { servingAmount: newServingAmount });
                          toast({ title: 'Updated', description: `${food.name} — ${grams}g` });
                        }}
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
                  <h2 className="text-[17px] font-semibold text-foreground flex items-center gap-2 tracking-tight">
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
                    <div key={entry.id} className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 flex items-center justify-between group border border-border/30 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-2xl bg-destructive/10 text-destructive">
                          <Dumbbell className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-[14px] text-foreground tracking-tight">{entry.name}</p>
                           <p className="text-[12px] text-muted-foreground/70">
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

            {/* Quick Add — discoverable shortcuts before the deep dive */}
            <QuickAddPanel foods={foods} onSelect={handleQuickAdd} />

            {/* Nutrients Summary — detailed micros at the bottom */}
            <NutrientsSummary 
              todayNutrients={todayNutrients}
              dailyGoals={dailyGoals}
              customNutrients={settings.customNutrients}
            />
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
            onAddRecipe={() => { setEditingRecipe(null); setShowRecipeBuilder(true); }}
            onEditRecipe={(food) => { setEditingRecipe(food); setShowRecipeBuilder(true); }}
          />
        );

      case 'trends':
        return (
          <TrendsView
            foods={foods}
            logs={logs}
            dailyGoals={dailyGoals}
            isPremium={isPremium}
            customNutrients={settings.customNutrients}
          />
        );

      case 'profile':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={settingsQuery}
                onChange={(e) => setSettingsQuery(e.target.value)}
                placeholder="Search settings..."
                className="w-full h-12 pl-10 pr-10 rounded-[16px] bg-card/70 backdrop-blur-2xl border border-border/40 text-[16px] text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-ring/60 focus:border-ring/50 shadow-sm transition-all"
              />
              {settingsQuery && (
                <button
                  type="button"
                  onClick={() => setSettingsQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* ---------- Account ---------- */}
            {settingsMatches('account', 'premium', 'sign out', 'log out', 'login', 'user') && (
              <SettingsSection title={<HighlightText text="Account" query={q} />} icon={User}>
                {isPremium && (
                  <div className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 flex items-center gap-3 border border-border/30 shadow-sm">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-foreground tracking-tight">
                        <HighlightText text="Premium Active" query={q} />
                      </p>
                      <p className="text-[12px] text-muted-foreground/70">
                        <HighlightText text="All features unlocked" query={q} />
                      </p>
                    </div>
                  </div>
                )}
                {isLoggedIn ? (
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    disabled={signingOut}
                    className="w-full h-14 justify-start px-4 rounded-2xl text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10 transition-transform active:scale-[0.98] disabled:opacity-60"
                  >
                    {signingOut ? (
                      <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    ) : (
                      <LogOut className="h-5 w-5 mr-3" />
                    )}
                    {signingOut ? 'Signing out…' : <HighlightText text="Sign Out" query={q} />}
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate('/auth')}
                    className="w-full h-14 justify-start px-4 rounded-2xl transition-transform active:scale-[0.98]"
                  >
                    <LogOut className="h-5 w-5 mr-3 rotate-180" />
                    <HighlightText text="Log In" query={q} />
                  </Button>
                )}
              </SettingsSection>
            )}

            {/* ---------- Goals & nutrition ---------- */}
            {settingsMatches('goals', 'nutrition', 'daily goals', 'settings', 'nutrient library', 'import', 'export', 'json') && (
              <SettingsSection title="Goals & Nutrition" icon={Target}>
                <Button
                  onClick={() => isPremium ? setShowSettings(true) : setShowDonationGate(true)}
                  className={`w-full ios-button-secondary h-14 justify-start px-4 transition-transform active:scale-[0.98] ${!isPremium ? 'opacity-50' : ''}`}
                >
                  <Settings className="h-5 w-5 mr-3" />
                  Daily Goals & Settings
                  {!isPremium && <Lock className="h-3.5 w-3.5 ml-auto" />}
                </Button>
                <NutrientLibraryCard foods={foods} mergeFoods={mergeFoods} />
              </SettingsSection>
            )}

            {/* ---------- Appearance ---------- */}
            {settingsMatches('appearance', 'theme', 'color', 'font', 'texture', 'pack', 'dark mode', 'mode') && (
              <SettingsSection title="Appearance" icon={Palette}>
                <AppearanceSettings
                  appearance={appearance}
                  onUpdate={updateAppearance}
                  isPremium={isPremium}
                  onShowDonationGate={() => setShowDonationGate(true)}
                />
                <ThemePackCard isPremium={isPremium} onShowDonationGate={() => setShowDonationGate(true)} />
              </SettingsSection>
            )}

            {/* ---------- Data & sync ---------- */}
            {settingsMatches('data', 'sync', 'apple health', 'healthkit', 'export') && (
              <SettingsSection title="Data & Sync" icon={Database}>
                {isPremium ? (
                  <HealthKitExport
                    foods={foods}
                    logs={logs}
                    getTodayNutrients={getTodayNutrients}
                  />
                ) : (
                  <Button
                    onClick={() => setShowDonationGate(true)}
                    className="w-full ios-button-secondary h-14 justify-start px-4 opacity-50"
                  >
                    <Heart className="h-5 w-5 mr-3 text-destructive" />
                    Apple Health Export
                    <Lock className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                )}
              </SettingsSection>
            )}

            {/* ---------- Support ---------- */}
            {settingsMatches('support', 'feedback', 'help', 'contact', 'bug', 'feature') && (
              <SettingsSection title="Support" icon={LifeBuoy}>
                <FeedbackCard isLoggedIn={isLoggedIn} />
              </SettingsSection>
            )}

            {/* ---------- Advanced / diagnostics ---------- */}
            {settingsMatches('advanced', 'backup', 'restore', 'export', 'import', 'offline', 'simulation', 'error', 'log', 'debug', 'test', 'checklist', 'diagnostics', 'developer') && (
              <SettingsSection
                key={q ? 'advanced-open' : 'advanced-closed'}
                title="Advanced"
                icon={Wrench}
                description="Diagnostics, backups and developer tools."
                collapsible={!q}
                defaultOpen={!!q}
              >
                <SettingsGroup>
                  {settingsMatches('advanced', 'backup', 'restore', 'export', 'import') && (
                    <BackupCard
                      exportDatabase={exportDatabase}
                      importDatabase={importDatabase}
                      foodsCount={foods.length}
                      logsCount={logs.length}
                    />
                  )}
                  {settingsMatches('advanced', 'offline', 'simulation', 'local', 'files') && (
                    <OfflineSimulationCard />
                  )}
                  {settingsMatches('advanced', 'error', 'log', 'debug') && (
                    <ErrorLogCard />
                  )}
                  {isAdmin && settingsMatches('advanced', 'test', 'checklist', 'system test', 'diagnostics') && (
                    <Button
                      onClick={() => navigate('/test-checklist')}
                      variant="outline"
                      className="w-full h-14 justify-start px-4 transition-transform active:scale-[0.98]"
                    >
                      <ClipboardCheck className="h-5 w-5 mr-3" />
                      Test Checklist
                      <span className="ml-auto text-xs text-muted-foreground">Admin only</span>
                    </Button>
                  )}
                </SettingsGroup>
              </SettingsSection>
            )}

            {q && !(
              settingsMatches('account', 'premium', 'sign out', 'log out', 'login', 'user') ||
              settingsMatches('goals', 'nutrition', 'daily goals', 'settings', 'nutrient library', 'import', 'export', 'json') ||
              settingsMatches('appearance', 'theme', 'color', 'font', 'texture', 'pack', 'dark mode', 'mode') ||
              settingsMatches('data', 'sync', 'apple health', 'healthkit', 'export') ||
              settingsMatches('support', 'feedback', 'help', 'contact', 'bug', 'feature') ||
              settingsMatches('advanced', 'backup', 'restore', 'export', 'import', 'offline', 'simulation', 'error', 'log', 'debug', 'test', 'checklist', 'diagnostics', 'developer')
            ) && (
              <div className="text-center py-10">
                <p className="text-[15px] text-muted-foreground">No settings match "{settingsQuery}"</p>
                <button
                  type="button"
                  onClick={() => setSettingsQuery('')}
                  className="mt-2 text-[13px] text-primary hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Footer links */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 pb-4">
              <button
                onClick={() => window.open('https://buymeacoffee.com/Simon0907', '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60 hover:text-primary transition-colors"
              >
                <Heart className="h-3 w-3" />
                Support this app
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </button>
              {!isPremium && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <button
                    onClick={handleRestorePurchase}
                    disabled={restoringPurchase}
                    className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    {restoringPurchase ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    {restoringPurchase ? 'Checking…' : 'Restore Purchase'}
                  </button>
                </>
              )}
              <span className="text-muted-foreground/30">·</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60 hover:text-destructive transition-colors">
                    <Trash2 className="h-3 w-3" />
                    Delete Account
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Delete Account?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your account and all associated data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingAccount} className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deletingAccount}
                      className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-70"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (deletingAccount) return;
                        setDeletingAccount(true);
                        try {
                          const { error } = await supabase.rpc('delete_own_account' as any);
                          if (error) throw error;
                          await supabase.auth.signOut();
                          toast({ title: 'Account deleted', description: 'Your account has been permanently removed.' });
                          navigate('/auth');
                        } catch (err) {
                          toast({
                            title: 'Could not delete account',
                            description: err instanceof Error ? err.message : 'Please try again.',
                            variant: 'destructive',
                          });
                          setDeletingAccount(false);
                        }
                      }}
                    >
                      {deletingAccount ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        'Delete Forever'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
      case 'profile': return '';
      default: return 'NutriTrack';
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="min-h-svh bg-background relative"
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
      <Header title={getTitle()} />

      <ScrollArea className="h-[calc(100vh-140px)]">
        <main className="max-w-lg mx-auto px-5 pb-6 safe-bottom">
          {renderContent()}
        </main>
      </ScrollArea>

      <BottomNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onAddFood={() => setShowAddFood(true)}
        onScanBarcode={() => setShowScanner(true)}
        onAILookup={() => aiLocked ? setShowDonationGate(true) : setShowAILookup(true)}
        onImport={handleImport}
        onLockedTab={() => setShowDonationGate(true)}
        isPremium={isPremium}
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

      <RecipeBuilderModal
        open={showRecipeBuilder}
        onClose={() => { setShowRecipeBuilder(false); setEditingRecipe(null); }}
        foods={foods}
        initial={editingRecipe}
        onSave={({ name, recipe }) => {
          const fields = buildRecipeFoodFields(name, recipe, foods);
          if (editingRecipe) {
            updateFood(editingRecipe.id, fields);
            toast({ title: 'Recipe updated', description: name });
          } else {
            addFood(fields);
            toast({ title: 'Recipe created', description: name });
          }
        }}
      />

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        localFoods={foods}
      />

      <AILookupModal
        open={showAILookup}
        onClose={() => setShowAILookup(false)}
        localFoods={foods}
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

      <DonationGateModal
        open={showDonationGate}
        onClose={() => setShowDonationGate(false)}
        onUnlocked={recheckPremium}
      />
    </div>
  );
}
