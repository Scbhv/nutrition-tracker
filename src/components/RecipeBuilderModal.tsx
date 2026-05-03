import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, GripVertical, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FoodItem, Recipe, RecipeIngredient } from '@/types/nutrients';
import { computeRecipeTotals } from '@/lib/recipe';
import { sanitizeText } from '@/lib/inputSanitization';
import { cn } from '@/lib/utils';

interface RecipeBuilderModalProps {
  open: boolean;
  onClose: () => void;
  foods: FoodItem[];
  /** Optional existing recipe food being edited. */
  initial?: FoodItem | null;
  onSave: (data: { name: string; recipe: Recipe }) => void;
}

const SUGGESTED_TAGS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'vegan', 'vegetarian', 'high-protein'];

export function RecipeBuilderModal({ open, onClose, foods, initial, onSave }: RecipeBuilderModalProps) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [prepMinutes, setPrepMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [search, setSearch] = useState('');

  // Hydrate from initial when opened
  useEffect(() => {
    if (!open) return;
    if (initial?.recipe) {
      setName(initial.name);
      setServings(String(initial.recipe.servings));
      setPrepMinutes(initial.recipe.prepMinutes ? String(initial.recipe.prepMinutes) : '');
      setNotes(initial.recipe.notes || '');
      setTags(initial.recipe.tags || []);
      setInstructions(initial.recipe.instructions?.length ? initial.recipe.instructions : ['']);
      setIngredients(initial.recipe.ingredients);
    } else {
      setName('');
      setServings('1');
      setPrepMinutes('');
      setNotes('');
      setTags([]);
      setTagInput('');
      setInstructions(['']);
      setIngredients([]);
    }
    setSearch('');
  }, [open, initial]);

  const recipeFoods = useMemo(() => foods.filter(f => !f.recipe), [foods]);
  const filteredFoods = useMemo(() => {
    if (!search.trim()) return recipeFoods.slice(0, 30);
    const q = search.toLowerCase();
    return recipeFoods.filter(f =>
      f.name.toLowerCase().includes(q) || f.brand?.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [recipeFoods, search]);

  const totals = useMemo(() => computeRecipeTotals(ingredients, foods), [ingredients, foods]);
  const servingsNum = Math.max(1, parseFloat(servings) || 1);
  const perServingKcal = totals.totalGrams > 0
    ? (totals.totals['energy-kcal'] || 0) / servingsNum
    : 0;
  const perServingGrams = totals.totalGrams / servingsNum;

  const addIngredient = (food: FoodItem) => {
    setIngredients(prev => {
      const existing = prev.find(i => i.foodId === food.id);
      if (existing) {
        return prev.map(i => i.foodId === food.id ? { ...i, grams: i.grams + (food.servingSize || 100) } : i);
      }
      return [...prev, { foodId: food.id, name: food.name, grams: food.servingSize || 100 }];
    });
  };

  const updateIngredientGrams = (foodId: string, grams: string) => {
    const n = parseFloat(grams);
    setIngredients(prev => prev.map(i => i.foodId === foodId ? { ...i, grams: isNaN(n) ? 0 : n } : i));
  };

  const removeIngredient = (foodId: string) => {
    setIngredients(prev => prev.filter(i => i.foodId !== foodId));
  };

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags(prev => [...prev, t].slice(0, 12));
    setTagInput('');
  };

  const updateInstruction = (idx: number, value: string) => {
    setInstructions(prev => prev.map((s, i) => i === idx ? value : s));
  };

  const addInstructionStep = () => setInstructions(prev => [...prev, '']);
  const removeInstructionStep = (idx: number) =>
    setInstructions(prev => prev.length === 1 ? [''] : prev.filter((_, i) => i !== idx));

  const canSave = name.trim().length > 0 && ingredients.length > 0 && ingredients.every(i => i.grams > 0);

  const handleSave = () => {
    if (!canSave) return;
    const recipe: Recipe = {
      ingredients,
      servings: servingsNum,
      instructions: instructions.map(s => s.trim()).filter(Boolean),
      prepMinutes: prepMinutes ? Math.max(0, parseFloat(prepMinutes)) : undefined,
      tags: tags.length ? tags : undefined,
      notes: notes.trim() ? sanitizeText(notes, 1000) : undefined,
    };
    onSave({ name: sanitizeText(name, 200), recipe });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 bg-card border-border rounded-3xl">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            {initial?.recipe ? 'Edit Recipe' : 'New Recipe'}
          </DialogTitle>
          <DialogDescription className="sr-only">Build a recipe from foods in your library.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[65vh] px-6">
          <div className="space-y-5 pb-4">
            {/* Basics */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Recipe name</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 200))}
                  placeholder="e.g., Overnight Oats"
                  className="bg-secondary border-0 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Servings</Label>
                  <Input
                    type="number" min="1" inputMode="decimal"
                    value={servings} onChange={e => setServings(e.target.value)}
                    className="bg-secondary border-0 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Prep (min)</Label>
                  <Input
                    type="number" min="0" inputMode="numeric"
                    value={prepMinutes} onChange={e => setPrepMinutes(e.target.value)}
                    placeholder="Optional"
                    className="bg-secondary border-0 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Ingredients */}
            <section className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Ingredients ({ingredients.length})
              </h3>

              {ingredients.length === 0 && (
                <p className="text-xs text-muted-foreground">Add foods from your library below.</p>
              )}

              <div className="space-y-2">
                {ingredients.map(ing => (
                  <div key={ing.foodId} className="flex items-center gap-2 bg-secondary rounded-xl p-2.5">
                    <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    <span className="flex-1 text-sm truncate">{ing.name}</span>
                    <Input
                      type="number" min="0" step="1" inputMode="decimal"
                      value={ing.grams}
                      onChange={e => updateIngredientGrams(ing.foodId, e.target.value)}
                      className="h-8 w-20 bg-muted border-0 rounded-lg text-sm text-right"
                    />
                    <span className="text-xs text-muted-foreground">g</span>
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => removeIngredient(ing.foodId)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Food picker */}
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search foods to add…"
                    className="pl-10 bg-secondary border-0 rounded-xl"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/40">
                  {filteredFoods.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">No matching foods.</p>
                  ) : filteredFoods.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addIngredient(f)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/40 transition-colors"
                    >
                      <span className="text-sm truncate">{f.name}</span>
                      <Plus className="h-4 w-4 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Live nutrition */}
            <section className="rounded-2xl bg-secondary p-4 space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Per serving</p>
              <p className="text-2xl font-semibold">{Math.round(perServingKcal)} kcal</p>
              <p className="text-xs text-muted-foreground">
                {totals.totalGrams > 0
                  ? `${perServingGrams.toFixed(0)}g · yields ${servingsNum} serving${servingsNum > 1 ? 's' : ''} (${totals.totalGrams.toFixed(0)}g total)`
                  : 'Add ingredients to see totals.'}
              </p>
            </section>

            {/* Instructions */}
            <section className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Instructions</h3>
              {instructions.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="mt-2.5 text-xs text-muted-foreground w-5 text-right">{idx + 1}.</span>
                  <Textarea
                    value={step}
                    onChange={e => updateInstruction(idx, e.target.value)}
                    placeholder={`Step ${idx + 1}`}
                    rows={2}
                    className="bg-secondary border-0 rounded-xl resize-none flex-1"
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => removeInstructionStep(idx)}
                    className="h-8 w-8 mt-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addInstructionStep} className="rounded-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add step
              </Button>
            </section>

            {/* Tags */}
            <section className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <Badge key={t} variant="secondary" className="rounded-full pr-1">
                    {t}
                    <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="Add tag…"
                  className="bg-secondary border-0 rounded-xl"
                />
                <Button type="button" variant="secondary" onClick={() => addTag(tagInput)} className="rounded-xl">Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_TAGS.filter(s => !tags.includes(s)).map(s => (
                  <button
                    key={s} type="button" onClick={() => addTag(s)}
                    className={cn("text-xs px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:bg-accent/40")}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </section>

            {/* Notes */}
            <section className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Notes</h3>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value.slice(0, 1000))}
                placeholder="Optional description"
                rows={3}
                className="bg-secondary border-0 rounded-xl resize-none"
              />
            </section>
          </div>
        </ScrollArea>

        <div className="flex gap-3 p-6 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 ios-button-secondary">
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSave} className="flex-1 ios-button-primary">
            {initial?.recipe ? 'Save' : 'Create Recipe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
