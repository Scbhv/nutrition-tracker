import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NutrientBar } from '@/components/NutrientBar';
import { NutrientData, NUTRIENT_CATEGORIES, NUTRIENT_LABELS, CustomNutrient } from '@/types/nutrients';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NutrientsSummaryProps {
  todayNutrients: NutrientData;
  dailyGoals: NutrientData;
  customNutrients?: CustomNutrient[];
}

type SortOption = 'name' | 'progress' | 'amount';

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

const SORT_LABELS: Record<SortOption, string> = {
  name: 'Name',
  progress: 'Progress',
  amount: 'Amount',
};

export function NutrientsSummary({ todayNutrients, dailyGoals, customNutrients = [] }: NutrientsSummaryProps) {
  const [showMore, setShowMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name');

  const getGoal = (nutrient: string) => {
    return dailyGoals[nutrient as keyof NutrientData] || DEFAULT_GOALS[nutrient] || 100;
  };

  const getColor = (nutrient: string) => {
    return NUTRIENT_COLORS[nutrient] || 'bg-primary';
  };

  const getProgress = (nutrient: string) => {
    const current = todayNutrients[nutrient] || 0;
    const goal = getGoal(nutrient);
    return goal > 0 ? (current / goal) * 100 : 0;
  };

  const sortNutrients = (nutrients: string[]) => {
    return [...nutrients].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const nameA = customNutrients.find(n => n.id === a)?.label || NUTRIENT_LABELS[a] || a;
          const nameB = customNutrients.find(n => n.id === b)?.label || NUTRIENT_LABELS[b] || b;
          return nameA.localeCompare(nameB);
        case 'progress':
          return getProgress(b) - getProgress(a);
        case 'amount':
          return (todayNutrients[b] || 0) - (todayNutrients[a] || 0);
        default:
          return 0;
      }
    });
  };

  // Combine built-in + custom nutrient keys
  const allNutrientKeys = useMemo(() => {
    const builtIn = [...ALL_VITAMINS_MINERALS] as string[];
    const customKeys = customNutrients.map(n => n.id);
    return [...builtIn, ...customKeys];
  }, [customNutrients]);

  // Separate tracked (has value > 0) and untracked nutrients
  const { trackedNutrients, untrackedNutrients } = useMemo(() => {
    const tracked = allNutrientKeys.filter(
      nutrient => (todayNutrients[nutrient] || 0) > 0
    );
    const untracked = allNutrientKeys.filter(
      nutrient => (todayNutrients[nutrient] || 0) === 0
    );
    return {
      trackedNutrients: sortNutrients(tracked),
      untrackedNutrients: sortNutrients(untracked),
    };
  }, [todayNutrients, sortBy, allNutrientKeys]);

  return (
    <section className="glass-card rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Vitamins & Minerals</h3>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="text-xs">{SORT_LABELS[sortBy]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <DropdownMenuRadioItem value="name" className="text-sm">
                Sort by Name
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="progress" className="text-sm">
                Sort by Progress
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="amount" className="text-sm">
                Sort by Amount
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
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
