import { useEffect, useState } from 'react';
import { ScanBarcode, Sparkles, PenLine, Users, BookOpen, ChefHat, HelpCircle, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { FoodFlag, FoodItem, FoodSource } from '@/types/nutrients';

const SOURCES: Record<FoodSource | 'unknown', { label: string; Icon: LucideIcon; tone: string }> = {
  barcode: { label: 'Barcode', Icon: ScanBarcode, tone: 'bg-primary/15 text-primary' },
  ai: { label: 'AI lookup', Icon: Sparkles, tone: 'bg-accent text-accent-foreground' },
  manual: { label: 'Manual', Icon: PenLine, tone: 'bg-secondary text-secondary-foreground' },
  community: { label: 'Community', Icon: Users, tone: 'bg-primary/10 text-primary' },
  library: { label: 'Starter library', Icon: BookOpen, tone: 'bg-muted text-muted-foreground' },
  recipe: { label: 'Recipe', Icon: ChefHat, tone: 'bg-muted text-muted-foreground' },
  unknown: { label: 'Unknown source', Icon: HelpCircle, tone: 'bg-muted text-muted-foreground' },
};

export function FoodSourceBadge({ source }: { source?: FoodSource }) {
  const s = SOURCES[source ?? 'unknown'];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', s.tone)}>
      <s.Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

const REASONS = ['Calories wrong', 'Macros wrong', 'Vitamins/minerals wrong', 'Serving size wrong', 'Wrong product'];

export function FlagFoodDialog({
  food, open, onOpenChange, onSave,
}: {
  food: FoodItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (flag: FoodFlag | undefined) => void;
}) {
  const [reason, setReason] = useState(food.flag?.reason ?? REASONS[0]);
  const [note, setNote] = useState(food.flag?.note ?? '');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) { setReason(food.flag?.reason ?? REASONS[0]); setNote(food.flag?.note ?? ''); }
  }, [open, food.flag]);

  const save = async () => {
    setSending(true);
    onSave({ reason, note: note.trim() || undefined, flaggedAt: new Date().toISOString() });
    // Best effort: also send the report to the developer when signed in.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('feedback').insert({
          user_id: user.id,
          type: 'bug',
          message: `[Nutrient data flag] ${food.name}${food.brand ? ` (${food.brand})` : ''}${food.barcode ? ` · barcode ${food.barcode}` : ''}\nSource: ${food.source ?? 'unknown'}\nReason: ${reason}${note.trim() ? `\nNote: ${note.trim().slice(0, 1000)}` : ''}\nPer 100 g: ${food.nutrients['energy-kcal'] ?? 0} kcal, P ${food.nutrients.proteins ?? 0} g, C ${food.nutrients.carbohydrates ?? 0} g, F ${food.nutrients.fat ?? 0} g`,
        });
      }
    } catch { /* stays flagged locally */ }
    setSending(false);
    toast.success('Flagged — tap Edit to correct the values');
    onOpenChange(false);
  };

  const clear = () => {
    onSave(undefined);
    toast.success('Flag removed');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Flag incorrect data</DialogTitle>
          <DialogDescription>
            {food.name} · <FoodSourceBadge source={food.source} />
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <Button key={r} size="sm" variant={reason === r ? 'default' : 'outline'} className="rounded-full" onClick={() => setReason(r)}>
              {r}
            </Button>
          ))}
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder="What's wrong? e.g. label says 240 kcal per 100 g"
          rows={3}
        />
        <div className="flex flex-col gap-2">
          <Button onClick={save} disabled={sending} className="h-11">Flag this food</Button>
          {food.flag && <Button variant="outline" onClick={clear} className="h-11">Remove flag</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
