// Storage migrated to nativeStorage (Capacitor Filesystem + localStorage fallback).
import { useState, useEffect, useCallback, useRef } from 'react';
import { FoodItem, DailyLog, FoodEntry, ExerciseEntry, UserSettings, NutrientData, Weekday } from '@/types/nutrients';
import { validateImportData } from '@/lib/schemas/importValidation';
import { readJSONFile, writeJSONFile, STORAGE_FILES } from '@/lib/nativeStorage';
import { reportSource } from '@/lib/offlineMode';

const DEFAULT_SETTINGS: UserSettings = {
  defaultServingSize: 100,
  dailyGoals: {
    "energy-kcal": 2000,
    "fat": 65,
    "saturated-fat": 20,
    "carbohydrates": 300,
    "sugars": 50,
    "fiber": 25,
    "proteins": 50,
    "sodium": 2300,
    "potassium": 3500,
    "calcium": 1000,
    "magnesium": 400,
    "iron": 18,
    "vitamin-c": 90,
    "vitamin-d": 20,
    "water": 2500,
  },
};

export function useFoodDatabase() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoaded = useRef(false);

  // Load data from local JSON files (or localStorage on web)
  useEffect(() => {
    (async () => {
      try {
        const [storedFoods, storedLogs, storedSettings] = await Promise.all([
          readJSONFile<FoodItem[]>(STORAGE_FILES.foods),
          readJSONFile<DailyLog[]>(STORAGE_FILES.logs),
          readJSONFile<Partial<UserSettings>>(STORAGE_FILES.settings),
        ]);

        if (storedFoods) setFoods(storedFoods);
        if (storedLogs) setLogs(storedLogs);
        if (storedSettings) setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        hasLoaded.current = true;
        setIsLoading(false);
      }
    })();
  }, []);

  // Save foods automatically
  useEffect(() => {
    if (!hasLoaded.current) return;
    writeJSONFile(STORAGE_FILES.foods, foods).catch(err =>
      console.error('Failed to save foods:', err)
    );
  }, [foods]);

  // Save logs automatically
  useEffect(() => {
    if (!hasLoaded.current) return;
    writeJSONFile(STORAGE_FILES.logs, logs).catch(err =>
      console.error('Failed to save logs:', err)
    );
  }, [logs]);

  // Save settings automatically
  useEffect(() => {
    if (!hasLoaded.current) return;
    writeJSONFile(STORAGE_FILES.settings, settings).catch(err =>
      console.error('Failed to save settings:', err)
    );
  }, [settings]);

  const addFood = useCallback((food: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newFood: FoodItem = {
      ...food,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFoods(prev => [...prev, newFood]);
    return newFood;
  }, []);

  const updateFood = useCallback((id: string, updates: Partial<FoodItem>) => {
    setFoods(prev => prev.map(food => 
      food.id === id 
        ? { ...food, ...updates, updatedAt: new Date().toISOString() }
        : food
    ));
  }, []);

  const deleteFood = useCallback((id: string) => {
    setFoods(prev => prev.filter(food => food.id !== id));
  }, []);

  const getFoodByBarcode = useCallback((barcode: string) => {
    return foods.find(food => food.barcode === barcode);
  }, [foods]);

  const addFoodEntry = useCallback((foodId: string, servingAmount: number = 1) => {
    const today = new Date().toISOString().split('T')[0];
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      foodId,
      servingAmount,
      timestamp: new Date().toISOString(),
    };

    setLogs(prev => {
      const existingLog = prev.find(log => log.date === today);
      if (existingLog) {
        return prev.map(log =>
          log.date === today
            ? { ...log, entries: [...log.entries, entry] }
            : log
        );
      } else {
        return [...prev, { id: crypto.randomUUID(), date: today, entries: [entry] }];
      }
    });

    return entry;
  }, []);

  const removeFoodEntry = useCallback((date: string, entryId: string) => {
    setLogs(prev => prev.map(log =>
      log.date === date
        ? { ...log, entries: log.entries.filter(e => e.id !== entryId) }
        : log
    ));
  }, []);

  const updateFoodEntry = useCallback((date: string, entryId: string, updates: Partial<FoodEntry>) => {
    setLogs(prev => prev.map(log =>
      log.date === date
        ? {
            ...log,
            entries: log.entries.map(e => {
              if (e.id !== entryId) return e;
              // If servingAmount is changing, capture history
              const portionChanged =
                updates.servingAmount !== undefined &&
                updates.servingAmount !== e.servingAmount;
              return {
                ...e,
                ...updates,
                ...(portionChanged
                  ? {
                      previousServingAmount: e.servingAmount,
                      editedAt: new Date().toISOString(),
                    }
                  : {}),
              };
            }),
          }
        : log
    ));
  }, []);

  const addExerciseEntry = useCallback((name: string, caloriesBurned: number, durationMinutes?: number) => {
    const today = new Date().toISOString().split('T')[0];
    const entry: ExerciseEntry = {
      id: crypto.randomUUID(),
      name,
      caloriesBurned,
      durationMinutes,
      timestamp: new Date().toISOString(),
    };

    setLogs(prev => {
      const existingLog = prev.find(log => log.date === today);
      if (existingLog) {
        return prev.map(log =>
          log.date === today
            ? { ...log, exerciseEntries: [...(log.exerciseEntries || []), entry] }
            : log
        );
      } else {
        return [...prev, { id: crypto.randomUUID(), date: today, entries: [], exerciseEntries: [entry] }];
      }
    });

    return entry;
  }, []);

  const removeExerciseEntry = useCallback((date: string, entryId: string) => {
    setLogs(prev => prev.map(log =>
      log.date === date
        ? { ...log, exerciseEntries: (log.exerciseEntries || []).filter(e => e.id !== entryId) }
        : log
    ));
  }, []);

  const getTodayLog = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return logs.find(log => log.date === today) || { id: '', date: today, entries: [], exerciseEntries: [] };
  }, [logs]);

  const getTodayBurnedCalories = useCallback((): number => {
    const todayLog = getTodayLog();
    return (todayLog.exerciseEntries || []).reduce((sum, e) => sum + e.caloriesBurned, 0);
  }, [getTodayLog]);

  const getTodayNutrients = useCallback((): NutrientData => {
    const todayLog = getTodayLog();
    const totals: NutrientData = {};

    todayLog.entries.forEach(entry => {
      const food = foods.find(f => f.id === entry.foodId);
      if (food) {
        const multiplier = (entry.servingAmount * food.servingSize) / 100;
        Object.entries(food.nutrients).forEach(([key, value]) => {
          if (typeof value === 'number') {
            const nutrientKey = key as keyof NutrientData;
            totals[nutrientKey] = (totals[nutrientKey] || 0) + value * multiplier;
          }
        });
      }
    });

    return totals;
  }, [getTodayLog, foods]);

  const exportDatabase = useCallback(() => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      foods,
      logs,
      settings,
    };
    return JSON.stringify(data, null, 2);
  }, [foods, logs, settings]);

  const importDatabase = useCallback((jsonString: string): { success: boolean; errorMessage?: string } => {
    const validation = validateImportData(jsonString);
    
    if (!validation.success) {
      console.error('Import validation failed:', validation.errorMessage);
      return { success: false, errorMessage: validation.errorMessage };
    }
    
    const data = validation.data!;
    if (data.foods && data.foods.length > 0) setFoods(data.foods as FoodItem[]);
    if (data.logs && data.logs.length > 0) setLogs(data.logs as DailyLog[]);
    if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings as UserSettings });
    
    return { success: true };
  }, []);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  /** Resolve goals for a specific date, merging weekday overrides onto defaults. */
  const getGoalsForDate = useCallback((date?: Date): NutrientData => {
    const d = date || new Date();
    const dayOfWeek = d.getDay() as Weekday;
    
    if (!settings.weekdayGoalsEnabled || !settings.weekdayGoals?.[dayOfWeek]) {
      return settings.dailyGoals;
    }
    
    // Merge: weekday overrides on top of default goals
    return { ...settings.dailyGoals, ...settings.weekdayGoals[dayOfWeek] };
  }, [settings]);

  const mergeFoods = useCallback((newFoods: FoodItem[]) => {
    setFoods(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const existingBarcodes = new Set(prev.filter(f => f.barcode).map(f => f.barcode));
      
      const uniqueNewFoods = newFoods.filter(food => {
        // Skip if ID already exists
        if (existingIds.has(food.id)) return false;
        // Skip if barcode already exists
        if (food.barcode && existingBarcodes.has(food.barcode)) return false;
        return true;
      }).map(food => ({
        ...food,
        id: crypto.randomUUID(), // Generate new IDs to avoid conflicts
        updatedAt: new Date().toISOString(),
      }));
      
      return [...prev, ...uniqueNewFoods];
    });
  }, []);

  return {
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
  };
}
