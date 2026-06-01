/**
 * Whole-unit serving presets for common foods.
 * Maps a keyword (matched against food name, case-insensitive) to one or more
 * natural "whole item" portions in grams. USDA-style averages, medium size.
 */
export interface WholeUnitPreset {
  label: string;
  grams: number;
}

const PRESETS: Record<string, WholeUnitPreset[]> = {
  apple:       [{ label: '1 small',  grams: 150 }, { label: '1 medium', grams: 180 }, { label: '1 large', grams: 220 }],
  banana:      [{ label: '1 small',  grams: 100 }, { label: '1 medium', grams: 118 }, { label: '1 large', grams: 140 }],
  orange:      [{ label: '1 medium', grams: 130 }, { label: '1 large',  grams: 180 }],
  pear:        [{ label: '1 medium', grams: 178 }],
  peach:       [{ label: '1 medium', grams: 150 }],
  plum:        [{ label: '1 medium', grams: 66 }],
  kiwi:        [{ label: '1 fruit',  grams: 75 }],
  strawberry:  [{ label: '1 berry',  grams: 12 }, { label: '1 cup', grams: 150 }],
  blueberry:   [{ label: '1 cup',    grams: 148 }],
  grape:       [{ label: '1 cup',    grams: 150 }],
  lemon:       [{ label: '1 medium', grams: 58 }],
  lime:        [{ label: '1 medium', grams: 67 }],
  avocado:     [{ label: '½ medium', grams: 100 }, { label: '1 medium', grams: 200 }],
  tomato:      [{ label: '1 medium', grams: 123 }, { label: '1 cherry', grams: 17 }],
  carrot:      [{ label: '1 medium', grams: 61 }, { label: '1 large', grams: 72 }],
  cucumber:    [{ label: '1 medium', grams: 200 }],
  potato:      [{ label: '1 small',  grams: 170 }, { label: '1 medium', grams: 213 }, { label: '1 large', grams: 369 }],
  egg:         [{ label: '1 medium', grams: 50 }, { label: '1 large',  grams: 58 }, { label: '1 jumbo', grams: 70 }],
  bread:       [{ label: '1 slice',  grams: 28 }],
  toast:       [{ label: '1 slice',  grams: 28 }],
  bagel:       [{ label: '1 medium', grams: 105 }],
  tortilla:    [{ label: '1 small',  grams: 30 }, { label: '1 large', grams: 70 }],
  rice:        [{ label: '1 cup cooked', grams: 158 }],
  pasta:       [{ label: '1 cup cooked', grams: 140 }],
  oat:         [{ label: '½ cup dry',    grams: 40 }, { label: '1 cup cooked', grams: 234 }],
  yogurt:      [{ label: '1 small cup',  grams: 150 }, { label: '1 large cup', grams: 250 }],
  milk:        [{ label: '1 glass',   grams: 240 }],
  chicken:     [{ label: '1 breast',  grams: 170 }, { label: '1 thigh', grams: 110 }],
  beef:        [{ label: '1 patty',   grams: 113 }],
  fish:        [{ label: '1 fillet',  grams: 140 }],
  salmon:      [{ label: '1 fillet',  grams: 140 }],
  tuna:        [{ label: '1 can',     grams: 142 }],
  shrimp:      [{ label: '1 piece',   grams: 7 }],
  almond:      [{ label: '1 nut',     grams: 1.2 }, { label: '1 handful', grams: 28 }],
  walnut:      [{ label: '1 half',    grams: 4 }, { label: '1 handful', grams: 28 }],
  cashew:      [{ label: '1 handful', grams: 28 }],
  cheese:      [{ label: '1 slice',   grams: 28 }],
  cookie:      [{ label: '1 cookie',  grams: 16 }],
  muffin:      [{ label: '1 muffin',  grams: 113 }],
  croissant:   [{ label: '1 medium',  grams: 57 }],
  pizza:       [{ label: '1 slice',   grams: 107 }],
};

/**
 * Return whole-unit presets matching this food name, or [] if none.
 * Matches the first keyword whose word appears in the lowercased food name.
 */
export function getWholeUnitPresets(foodName: string): WholeUnitPreset[] {
  const name = foodName.toLowerCase();
  for (const [key, presets] of Object.entries(PRESETS)) {
    if (name.includes(key)) return presets;
  }
  return [];
}
