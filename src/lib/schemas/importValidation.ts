import { z } from 'zod';

// Nutrient data schema - allows any nutrient key with non-negative number values
export const NutrientDataSchema = z.record(z.string(), z.number().nonnegative()).optional().default({});

// Food item schema with validation
export const FoodItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  servingSize: z.number().positive(),
  servingUnit: z.string().min(1),
  nutrients: NutrientDataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Food entry schema
export const FoodEntrySchema = z.object({
  id: z.string().min(1),
  foodId: z.string().min(1),
  servingAmount: z.number().positive(),
  timestamp: z.string(),
});

// Daily log schema
export const DailyLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  entries: z.array(FoodEntrySchema),
});

// User settings schema
export const UserSettingsSchema = z.object({
  defaultServingSize: z.number().positive(),
  dailyGoals: NutrientDataSchema,
});

// Full import data schema
export const ImportDataSchema = z.object({
  version: z.string().optional(),
  exportedAt: z.string().optional(),
  foods: z.array(FoodItemSchema).optional().default([]),
  logs: z.array(DailyLogSchema).optional().default([]),
  settings: UserSettingsSchema.optional(),
});

export type ImportData = z.infer<typeof ImportDataSchema>;
export type ValidationResult = {
  success: boolean;
  data?: ImportData;
  errors?: z.ZodError['errors'];
  errorMessage?: string;
};

export function validateImportData(jsonString: string): ValidationResult {
  try {
    const parsed = JSON.parse(jsonString);
    const result = ImportDataSchema.safeParse(parsed);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return {
        success: false,
        errors: result.error.errors,
        errorMessage: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      };
    }
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON format',
    };
  }
}
