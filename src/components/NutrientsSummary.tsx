import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NutrientBar } from '@/components/NutrientBar';
import { NutrientData, NUTRIENT_CATEGORIES, NUTRIENT_LABELS } from '@/types/nutrients';

interface NutrientsSummaryProps {
  todayNutrients: NutrientData;
  dailyGoals: NutrientData;
}

const ALL_VITAMINS_MINERALS = [
  ...NUTRIENT_CATEGORIES.vitamins,
  ...NUTRIENT_CATEGORIES.minerals,
  'water',
] as const;

const NUTRIENT_COLORS: Record<string, string> = {
  // Vitamins
  'vitamin-a': 'bg-orange-500',
  'vitamin-b6': 'bg-yellow-500',
  'vitamin-b12': 'bg-red-400',
  'vitamin-c': 'bg-orange-400',
  'vitamin-d': 'bg-yellow-400',
  'vitamin-e': 'bg-green-400',
  'vitamin-k': 'bg-emerald-500',
  'thiamine': 'bg-amber-500',
  'riboflavin': 'bg-amber-400',
  'pantothenic-acid': 'bg-yellow-600',
  'biotin': 'bg-pink-400',
  'folate': 'bg-green-500',
  // Minerals
  'sodium': 'bg-blue-400',
  'potassium': 'bg-purple-400',
  'calcium': 'bg-slate-400',
  'magnesium': 'bg-teal-400',
  'iron': 'bg-red-500',
  'zinc': 'bg-zinc-400',
  'copper': 'bg-orange-600',
  'manganese': 'bg-amber-600',
  'phosphorus': 'bg-indigo-400',
  'iodine': 'bg-violet-400',
  'chloride': 'bg-cyan-400',
  'selenium': 'bg-rose-400',
  'chrom': 'bg-gray-400',
  // Other
  'water': 'bg-sky-400',
};

const DEFAULT_GOALS: Record<string, number> = {
  'vitamin-a': 900,
  'vitamin-b6': 1.7,
  'vitamin-b12': 2.4,
  'vitamin-c': 90,
  'vitamin-d': 20,
  'vitamin-e': 15,
  'vitamin-k': 120,
  'thiamine': 1.2,
  'riboflavin': 1.3,
  'pantothenic-acid': 5,
  'biotin': 30,
  'folate': 400,
  'sodium': 2300,
  'potassium': 3500,
  'calcium': 1000,
  'magnesium': 400,
  'iron': 18,
  'zinc': 11,
  'copper': 0.9,
  'manganese': 2.3,
  'phosphorus': 700,
  'iodine': 150,
  'chloride': 2300,
  'selenium': 55,
  'chrom': 35,
  'water': 2500,
};

export function NutrientsSummary({ todayNutrients, dailyGoals }: NutrientsSummaryProps) {
  const [showMore, setShowMore] = useState(false);

  // Separate tracked (has value > 0) and untracked nutrients
  const trackedNutrients = ALL_VITAMINS_MINERALS.filter(
    nutrient => (todayNutrients[nutrient] || 0) > 0
  );
  
  const untrackedNutrients = ALL_VITAMINS_MINERALS.filter(
    nutrient => (todayNutrients[nutrient] || 0) === 0
  );

  const getGoal = (nutrient: string) => {
    return dailyGoals[nutrient as keyof NutrientData] || DEFAULT_GOALS[nutrient] || 100;
  };

  const getColor = (nutrient: string) => {
    return NUTRIENT_COLORS[nutrient] || 'bg-primary';
  };

  return (
    <section className="glass-card rounded-2xl p-4 space-y-4">
      <h3 className="font-semibold text-foreground">Vitamins & Minerals</h3>
      
      {trackedNutrients.length === 0 && !showMore ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No vitamins or minerals tracked today
        </p>
      ) : (
        <div className="space-y-4">
          {/* Tracked nutrients (always visible) */}
          {trackedNutrients.map(nutrient => (
            <NutrientBar
              key={nutrient}
              nutrient={nutrient}
              current={todayNutrients[nutrient] || 0}
              goal={getGoal(nutrient)}
              colorClass={getColor(nutrient)}
            />
          ))}

          {/* Untracked nutrients (behind show more) */}
          {showMore && untrackedNutrients.map(nutrient => (
            <NutrientBar
              key={nutrient}
              nutrient={nutrient}
              current={0}
              goal={getGoal(nutrient)}
              colorClass={getColor(nutrient)}
            />
          ))}
        </div>
      )}

      {/* Show more/less button */}
      {untrackedNutrients.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMore(!showMore)}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          {showMore ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Show {untrackedNutrients.length} more nutrients
            </>
          )}
        </Button>
      )}
    </section>
  );
}
