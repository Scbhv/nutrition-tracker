import { supabase } from '@/integrations/supabase/client';
import type { NutrientData } from '@/types/nutrients';

export interface LabelResult {
  name: string | null;
  brand: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  nutrients: NutrientData;
  notes: string | null;
}

/** Shrink a photo to a JPEG data URL (max 1600 px) so uploads stay small. */
async function toDataUrl(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not open that photo.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function errorMessage(error: unknown, fallback: string) {
  try {
    const body = await (error as { context?: Response }).context?.json();
    return body?.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function readNutritionLabel(file: File, fields: Record<string, string>): Promise<LabelResult> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  const image = await toDataUrl(file);
  const { data, error } = await supabase.functions.invoke('nutrition-label', { body: { image, fields } });
  if (error) throw new Error(await errorMessage(error, 'Label reading failed. Please try again.'));
  if (data?.error) throw new Error(data.error);
  return data as LabelResult;
}

export interface MealEstimate extends LabelResult {
  items: string[];
  confidence: 'low' | 'medium' | 'high';
}

/** Estimate a whole meal's weight and per-100 g nutrients from a description and/or photo. */
export async function estimateMeal(
  description: string,
  file: File | null,
  fields: Record<string, string>,
): Promise<MealEstimate> {
  if (file && !file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  if (!file && description.trim().length < 3) throw new Error('Describe the meal or add a photo.');
  const image = file ? await toDataUrl(file) : undefined;
  const { data, error } = await supabase.functions.invoke('meal-estimate', {
    body: { image, description: description.trim(), fields },
  });
  if (error) throw new Error(await errorMessage(error, 'Meal estimate failed. Please try again.'));
  if (data?.error) throw new Error(data.error);
  return data as MealEstimate;
}

/** Re-run the online barcode lookup. Returns null when the product still isn't found. */
export async function retryBarcodeLookup(code: string) {
  const { data, error } = await supabase.functions.invoke('food-lookup', { body: { query: code, useAI: false } });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    if (status === 404) return null;
    throw new Error(await errorMessage(error, 'Lookup failed — check your connection and try again.'));
  }
  if (!data || data.error || !data.nutrients) return null;
  return {
    name: data.name ?? null,
    brand: data.brand ?? null,
    servingSize: null,
    servingUnit: null,
    nutrients: data.nutrients as NutrientData,
  };
}
