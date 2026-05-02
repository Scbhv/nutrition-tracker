import { z } from 'zod';
import { FoodItem, NutrientData } from '@/types/nutrients';
import { logError } from '@/lib/errorLog';

/** Shape of an entry inside a nutrient library file. ID/timestamps optional. */
const LibraryFoodSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  servingSize: z.number().positive().default(100),
  servingUnit: z.string().min(1).default('g'),
  nutrients: z.record(z.string(), z.number().nonnegative()).default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const NutrientLibrarySchema = z.object({
  version: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  foods: z.array(LibraryFoodSchema).min(1),
});

export type NutrientLibrary = z.infer<typeof NutrientLibrarySchema>;

/** Convert a parsed library entry into a fully-formed FoodItem. */
export function libraryEntryToFoodItem(entry: z.infer<typeof LibraryFoodSchema>): FoodItem {
  const now = new Date().toISOString();
  return {
    id: entry.id || crypto.randomUUID(),
    name: entry.name,
    brand: entry.brand,
    barcode: entry.barcode,
    servingSize: entry.servingSize,
    servingUnit: entry.servingUnit,
    nutrients: entry.nutrients as NutrientData,
    createdAt: entry.createdAt || now,
    updatedAt: now,
  };
}

export type ParseResult =
  | { success: true; library: NutrientLibrary; foods: FoodItem[] }
  | { success: false; error: string };

/** Parse a JSON string. Accepts a library object OR a bare array of foods. */
export function parseNutrientLibrary(jsonString: string): ParseResult {
  try {
    const raw = JSON.parse(jsonString);
    const wrapped = Array.isArray(raw) ? { foods: raw } : raw;
    const result = NutrientLibrarySchema.safeParse(wrapped);
    if (!result.success) {
      const msg = result.error.errors
        .slice(0, 3)
        .map(e => `${e.path.join('.') || 'root'}: ${e.message}`)
        .join(' · ');
      return { success: false, error: msg };
    }
    return {
      success: true,
      library: result.data,
      foods: result.data.foods.map(libraryEntryToFoodItem),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON',
    };
  }
}

/** Build an exportable library payload from current foods. */
export function buildExportLibrary(foods: FoodItem[], name = 'My Nutrient Library'): string {
  const payload: NutrientLibrary = {
    version: '1.0',
    name,
    description: `Exported ${new Date().toISOString()} · ${foods.length} foods`,
    foods: foods.map(f => ({
      id: f.id,
      name: f.name,
      brand: f.brand,
      barcode: f.barcode,
      servingSize: f.servingSize,
      servingUnit: f.servingUnit,
      nutrients: Object.fromEntries(
        Object.entries(f.nutrients).filter(([, v]) => typeof v === 'number'),
      ) as Record<string, number>,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/** Fetch a remote .json library URL with a 10s timeout. */
export async function fetchRemoteLibrary(url: string): Promise<ParseResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { success: false, error: 'Enter a valid URL.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { success: false, error: 'Only http(s) URLs are supported.' };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(parsed.toString(), {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const text = await res.text();
    return parseNutrientLibrary(text);
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Request timed out after 10s'
          : err.message
        : 'Network error';
    logError('Nutrient Library', err, `Fetch failed for ${url}`);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export const SEED_LOADED_KEY = 'nutritrack-seed-loaded';
