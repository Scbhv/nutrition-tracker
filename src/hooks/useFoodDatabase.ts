import { useState, useEffect, useCallback } from 'react';
import { FoodItem, DailyLog, FoodEntry, UserSettings, NutrientData, Weekday } from '@/types/nutrients';
import { validateImportData } from '@/lib/schemas/importValidation';
const STORAGE_KEYS = {
  foods: 'nutrient-tracker-foods',
  logs: 'nutrient-tracker-logs',
  settings: 'nutrient-tracker-settings',
};

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

  // Load data from localStorage
  useEffect(() => {
    try {
      const storedFoods = localStorage.getItem(STORAGE_KEYS.foods);
      const storedLogs = localStorage.getItem(STORAGE_KEYS.logs);
      const storedSettings = localStorage.getItem(STORAGE_KEYS.settings);

      if (storedFoods) setFoods(JSON.parse(storedFoods));
      if (storedLogs) setLogs(JSON.parse(storedLogs));
      if (storedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save foods to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.foods, JSON.stringify(foods));
    }
  }, [foods, isLoading]);

  // Save logs to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
    }
  }, [logs, isLoading]);

  // Save settings to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    }
  }, [settings, isLoading]);

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

  const getTodayLog = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return logs.find(log => log.date === today) || { id: '', date: today, entries: [] };
  }, [logs]);

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
    getTodayLog,
    getTodayNutrients,
    exportDatabase,
    importDatabase,
    updateSettings,
    mergeFoods,
  };
}
