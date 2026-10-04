import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DailyLog, FoodItem, NutrientData } from '@/types/nutrients';

interface Props {
  logs: DailyLog[];
  foods: FoodItem[];
  goals: NutrientData;
}

const RANGES = [3, 7, 14] as const;

export function NutrientGapsCard({ logs, foods, goals }: Props) {
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const summary = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    const key = cutoff.toISOString().slice(0, 10);
    const recent = logs.filter((l) => l.date >= key && l.entries.length > 0);
    const byId = new Map(foods.map((f) => [f.id, f]));
    const totals: Record<string, number> = {};
    const names = new Set<string>();
    for (const log of recent) {
      for (const e of log.entries) {
        const food = byId.get(e.foodId);
        if (!food) continue;
        names.add(food.name);
        const grams = food.servingSize * e.servingAmount;
        for (const [k, v] of Object.entries(food.nutrients ?? {})) {
          if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + (v * grams) / 100;
        }
      }
    }
    const loggedDays = recent.length;
    const averages: Record<string, number> = {};
    if (loggedDays) for (const [k, v] of Object.entries(totals)) averages[k] = Math.round((v / loggedDays) * 10) / 10;
    const cleanGoals: Record<string, number> = {};
    for (const [k, v] of Object.entries(goals ?? {})) if (typeof v === 'number' && v > 0) cleanGoals[k] = v;
    return { loggedDays, averages, goals: cleanGoals, foods: [...names] };
  }, [logs, foods, goals, days]);

  const run = async () => {
    if (!summary.loggedDays) {
      toast.error('Log some food first so there is something to analyse.');
      return;
    }
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke('nutrient-gaps', {
        body: { days: summary.loggedDays, averages: summary.averages, goals: summary.goals, foods: summary.foods },
      });
      if (error) {
        let msg = 'Analysis failed. Please try again later.';
        try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* keep default */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Nutrient gap check</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        AI looks at your recent food log and goals, finds what you're short on, and suggests easy foods to add.
      </p>
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={days === r ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setDays(r)}
            disabled={loading}
          >
            {r} days
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.loggedDays} logged {summary.loggedDays === 1 ? 'day' : 'days'} · {summary.foods.length} foods
      </p>
      <Button onClick={run} disabled={loading} className="w-full h-12 transition-transform active:scale-[0.98]">
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analysing…</> : 'Find my nutrient gaps'}
      </Button>
      {analysis && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl bg-muted/50 p-3">
          <ReactMarkdown>{analysis}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
