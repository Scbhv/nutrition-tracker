import { FoodItem, NutrientData, Recipe, RecipeIngredient } from '@/types/nutrients';

/**
 * Compute the totals for a recipe by summing each ingredient's nutrients
 * scaled by its gram amount (food.nutrients are stored per 100g).
 */
export function computeRecipeTotals(
  ingredients: RecipeIngredient[],
  foods: FoodItem[],
): { totalGrams: number; totals: NutrientData } {
  const totals: NutrientData = {};
  let totalGrams = 0;

  for (const ing of ingredients) {
    const food = foods.find(f => f.id === ing.foodId);
    if (!food) continue;
    const factor = ing.grams / 100;
    totalGrams += ing.grams;
    Object.entries(food.nutrients).forEach(([key, value]) => {
      if (typeof value === 'number') {
        totals[key] = (totals[key] || 0) + value * factor;
      }
    });
  }

  return { totalGrams, totals };
}

/**
 * Convert a recipe definition into FoodItem fields. The resulting
 * FoodItem stores nutrients per 100g (so it integrates with the rest
 * of the app) and uses one serving as its serving size.
 */
export function buildRecipeFoodFields(
  name: string,
  recipe: Recipe,
  foods: FoodItem[],
): Pick<FoodItem, 'name' | 'servingSize' | 'servingUnit' | 'nutrients' | 'recipe'> {
  const { totalGrams, totals } = computeRecipeTotals(recipe.ingredients, foods);
  const servings = Math.max(1, recipe.servings || 1);
  const servingSize = totalGrams > 0 ? Math.round((totalGrams / servings) * 10) / 10 : 100;

  // Convert totals (absolute) to per-100g values.
  const nutrients: NutrientData = {};
  if (totalGrams > 0) {
    Object.entries(totals).forEach(([key, value]) => {
      if (typeof value === 'number') {
        nutrients[key] = (value / totalGrams) * 100;
      }
    });
  }

  return {
    name,
    servingSize,
    servingUnit: 'g',
    nutrients,
    recipe,
  };
}
