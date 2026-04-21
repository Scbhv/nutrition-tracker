export interface CustomNutrient {
  id: string;       // kebab-case key like "custom-omega-3"
  label: string;    // Display name like "Omega-3"
  unit: string;     // "g", "mg", "μg", "IU", "ml", etc.
  goal: number;     // Daily goal amount
}

export interface NutrientData {
  // Basic macros
  "energy-kcal"?: number;
  "fat"?: number;
  "saturated-fat"?: number;
  "unsaturated-fat"?: number;
  "carbohydrates"?: number;
  "sugars"?: number;
  "fiber"?: number;
  "proteins"?: number;
  "salt"?: number;
  "water"?: number;
  
  // Minerals
  "sodium"?: number;
  "potassium"?: number;
  "calcium"?: number;
  "magnesium"?: number;
  "iron"?: number;
  "zinc"?: number;
  "copper"?: number;
  "manganese"?: number;
  "phosphorus"?: number;
  "iodine"?: number;
  "chloride"?: number;
  "selenium"?: number;
  "chrom"?: number;
  
  // Vitamins
  "vitamin-a"?: number;
  "vitamin-b6"?: number;
  "vitamin-b12"?: number;
  "vitamin-c"?: number;
  "vitamin-d"?: number;
  "vitamin-e"?: number;
  "vitamin-k"?: number;
  "thiamine"?: number;
  "riboflavin"?: number;
  "pantothenic-acid"?: number;
  "biotin"?: number;
  "folate"?: number;
  
  // Other
  "cholesterol"?: number;
  "caffeine"?: number;
  "creatine"?: number;
  
  // Amino acids
  "valine"?: number;
  "isoleucine"?: number;
  "leucine"?: number;
  
  // Supplements
  "electrolyte-mix"?: number;
  "ashwaganda"?: number;
  
  // Index signature for custom nutrients
  [key: string]: number | undefined;
}

export interface FoodItem {
  id: string;
  name: string;
  barcode?: string;
  brand?: string;
  servingSize: number; // in grams
  servingUnit: string;
  nutrients: NutrientData; // per 100g
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  id: string;
  date: string;
  entries: FoodEntry[];
  exerciseEntries?: ExerciseEntry[];
}

export interface FoodEntry {
  id: string;
  foodId: string;
  servingAmount: number; // multiplier of serving size
  timestamp: string;
  /** Last time the portion was edited */
  editedAt?: string;
  /** Previous serving amount before the most recent edit */
  previousServingAmount?: number;
}

export interface ExerciseEntry {
  id: string;
  name: string;
  caloriesBurned: number;
  durationMinutes?: number;
  timestamp: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun … 6=Sat

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const WEEKDAY_FULL_LABELS: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export interface UserSettings {
  defaultServingSize: number;
  dailyGoals: NutrientData;
  weekdayGoalsEnabled?: boolean;
  /** Per-weekday goal overrides. Keys are 0 (Sun) – 6 (Sat). */
  weekdayGoals?: Partial<Record<Weekday, NutrientData>>;
  /** User-defined custom nutrients */
  customNutrients?: CustomNutrient[];
}

export const NUTRIENT_CATEGORIES = {
  macros: ["energy-kcal", "fat", "saturated-fat", "unsaturated-fat", "carbohydrates", "sugars", "fiber", "proteins", "salt", "water"],
  minerals: ["sodium", "potassium", "calcium", "magnesium", "iron", "zinc", "copper", "manganese", "phosphorus", "iodine", "chloride", "selenium", "chrom"],
  vitamins: ["vitamin-a", "vitamin-b6", "vitamin-b12", "vitamin-c", "vitamin-d", "vitamin-e", "vitamin-k", "thiamine", "riboflavin", "pantothenic-acid", "biotin", "folate"],
  other: ["cholesterol", "caffeine", "creatine", "valine", "isoleucine", "leucine", "electrolyte-mix", "ashwaganda"],
} as const;

export const NUTRIENT_UNITS: Record<string, string> = {
  "energy-kcal": "kcal",
  "fat": "g",
  "saturated-fat": "g",
  "unsaturated-fat": "g",
  "carbohydrates": "g",
  "sugars": "g",
  "fiber": "g",
  "proteins": "g",
  "salt": "g",
  "water": "ml",
  "sodium": "mg",
  "potassium": "mg",
  "calcium": "mg",
  "magnesium": "mg",
  "iron": "mg",
  "zinc": "mg",
  "copper": "mg",
  "manganese": "mg",
  "phosphorus": "mg",
  "iodine": "μg",
  "chloride": "mg",
  "selenium": "μg",
  "chrom": "μg",
  "vitamin-a": "μg",
  "vitamin-b6": "mg",
  "vitamin-b12": "μg",
  "vitamin-c": "mg",
  "vitamin-d": "μg",
  "vitamin-e": "mg",
  "vitamin-k": "μg",
  "thiamine": "mg",
  "riboflavin": "mg",
  "pantothenic-acid": "mg",
  "biotin": "μg",
  "folate": "μg",
  "cholesterol": "mg",
  "caffeine": "mg",
  "creatine": "g",
  "valine": "mg",
  "isoleucine": "mg",
  "leucine": "mg",
  "electrolyte-mix": "mg",
  "ashwaganda": "mg",
};

export const NUTRIENT_LABELS: Record<string, string> = {
  "energy-kcal": "Calories",
  "fat": "Fat",
  "saturated-fat": "Saturated Fat",
  "unsaturated-fat": "Unsaturated Fat",
  "carbohydrates": "Carbohydrates",
  "sugars": "Sugars",
  "fiber": "Fiber",
  "proteins": "Protein",
  "salt": "Salt",
  "water": "Water",
  "sodium": "Sodium",
  "potassium": "Potassium",
  "calcium": "Calcium",
  "magnesium": "Magnesium",
  "iron": "Iron",
  "zinc": "Zinc",
  "copper": "Copper",
  "manganese": "Manganese",
  "phosphorus": "Phosphorus",
  "iodine": "Iodine",
  "chloride": "Chloride",
  "selenium": "Selenium",
  "chrom": "Chromium",
  "vitamin-a": "Vitamin A",
  "vitamin-b6": "Vitamin B6 (Pyridoxine)",
  "vitamin-b12": "Vitamin B12 (Cobalamin)",
  "vitamin-c": "Vitamin C",
  "vitamin-d": "Vitamin D",
  "vitamin-e": "Vitamin E",
  "vitamin-k": "Vitamin K",
  "thiamine": "Vitamin B1 (Thiamine)",
  "riboflavin": "Vitamin B2 (Riboflavin)",
  "pantothenic-acid": "Vitamin B5 (Pantothenic Acid)",
  "biotin": "Vitamin B7 (Biotin)",
  "folate": "Vitamin B9 (Folate)",
  "cholesterol": "Cholesterol",
  "caffeine": "Caffeine",
  "creatine": "Creatine",
  "valine": "Valine",
  "isoleucine": "Isoleucine",
  "leucine": "Leucine",
  "electrolyte-mix": "Electrolyte Mix",
  "ashwaganda": "Ashwagandha",
};
