import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Save, X, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { FoodItem, NutrientData } from '@/types/nutrients';
import {
  NUTRIENT_CATEGORIES, NUTRIENT_LABELS, NUTRIENT_UNITS,
} from '@/types/nutrients';
import { buildExportLibrary, parseNutrientLibrary } from '@/lib/nutrientLibrary';

type Draft = {
  id: string;
  name: string;
  brand: string;
  barcode: string;
  servingSize: number;
  servingUnit: string;
  nutrients: Record<string, string>; // string for input editing
};

const ALL_KEYS = [
  ...NUTRIENT_CATEGORIES.macros,
  ...NUTRIENT_CATEGORIES.minerals,
  ...NUTRIENT_CATEGORIES.vitamins,
  ...NUTRIENT_CATEGORIES.other,
];

function emptyDraft(): Draft {
  return {
    id: crypto.randomUUID(),
    name: '',
    brand: '',
    barcode: '',
    servingSize: 100,
    servingUnit: 'g',
    nutrients: {},
  };
}

function foodToDraft(f: FoodItem): Draft {
  const n: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.nutrients)) {
    if (typeof v === 'number') n[k] = String(v);
  }
  return {
    id: f.id,
    name: f.name,
    brand: f.brand ?? '',
    barcode: f.barcode ?? '',
    servingSize: f.servingSize,
    servingUnit: f.servingUnit,
    nutrients: n,
  };
}

function draftToFood(d: Draft, prev?: FoodItem): FoodItem {
  const now = new Date().toISOString();
  const nutrients: NutrientData = {};
  for (const [k, v] of Object.entries(d.nutrients)) {
    const num = parseFloat(v);
    if (!Number.isNaN(num) && num >= 0) nutrients[k] = num;
  }
  return {
    id: d.id,
    name: d.name.trim(),
    brand: d.brand.trim() || undefined,
    barcode: d.barcode.trim() || undefined,
    servingSize: d.servingSize,
    servingUnit: d.servingUnit.trim() || 'g',
    nutrients,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
}

export default function NutrientEditor() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter(f =>
      f.name.toLowerCase().includes(q) || (f.brand?.toLowerCase().includes(q) ?? false)
    );
  }, [foods, search]);

  const startNew = () => { setEditingId(null); setDraft(emptyDraft()); };
  const startEdit = (f: FoodItem) => { setEditingId(f.id); setDraft(foodToDraft(f)); };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (!(draft.servingSize > 0)) {
      toast({ title: 'Serving size must be > 0', variant: 'destructive' });
      return;
    }
    const prev = editingId ? foods.find(f => f.id === editingId) : undefined;
    const next = draftToFood(draft, prev);
    setFoods(curr => {
      if (editingId) return curr.map(f => f.id === editingId ? next : f);
      return [next, ...curr];
    });
    setDraft(null);
    setEditingId(null);
    toast({ title: editingId ? 'Entry updated' : 'Entry added' });
  };

  const deleteFood = (id: string) => {
    setFoods(curr => curr.filter(f => f.id !== id));
    toast({ title: 'Entry deleted' });
  };

  const exportJson = () => {
    if (foods.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    const json = buildExportLibrary(foods, 'Nutrient Editor Export');
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nutrients-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: 'Exported', description: `${foods.length} entries saved as JSON.` });
  };

  const importJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const result = parseNutrientLibrary(text);
    if (result.success !== true) {
      toast({ title: 'Import failed', description: 'error' in result ? result.error : 'Invalid file', variant: 'destructive' });
      return;
    }
    setFoods(curr => {
      const ids = new Set(curr.map(f => f.id));
      const merged = [...curr];
      for (const f of result.foods) if (!ids.has(f.id)) merged.push(f);
      return merged;
    });
    toast({ title: 'Imported', description: `${result.foods.length} entries loaded.` });
  };

  const updateNutrient = (key: string, value: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      nutrients: { ...draft.nutrients, [key]: value },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-2xl bg-background/70 border-b border-border/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight">Nutrient Editor</h1>
            <p className="text-[11px] text-muted-foreground">{foods.length} entries · offline JSON</p>
          </div>
          <Button onClick={startNew} size="sm" className="ios-button-primary gap-1.5 h-9 rounded-2xl">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={exportJson} variant="outline" className="h-11 rounded-2xl gap-2">
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <Button onClick={() => fileRef.current?.click()} variant="outline" className="h-11 rounded-2xl gap-2">
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={importJson} className="hidden" />
        </div>

        {/* Search */}
        {foods.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="pl-9 h-11 rounded-2xl"
            />
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {foods.length === 0 ? 'No entries yet. Tap New to add your first food.' : 'No matches.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(f => (
              <li key={f.id} className="rounded-2xl bg-card/60 border border-border/30 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {f.brand ? `${f.brand} · ` : ''}{f.servingSize}{f.servingUnit} ·{' '}
                    {f.nutrients['energy-kcal'] ?? '–'} kcal · {Object.keys(f.nutrients).length} nutrients
                  </p>
                </div>
                <button onClick={() => startEdit(f)} className="p-2 rounded-full hover:bg-muted text-muted-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => deleteFood(f.id)} className="p-2 rounded-full hover:bg-destructive/10 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Editor dialog */}
      <Dialog open={!!draft} onOpenChange={v => !v && setDraft(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col rounded-3xl p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30">
            <DialogTitle>{editingId ? 'Edit entry' : 'New entry'}</DialogTitle>
            <DialogDescription className="sr-only">
              Add or edit a food's basic info and nutrient values per serving.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <ScrollArea className="flex-1 px-5 py-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name *</Label>
                  <Input
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    className="h-11 rounded-2xl"
                    placeholder="e.g. Greek Yogurt"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand</Label>
                    <Input
                      value={draft.brand}
                      onChange={e => setDraft({ ...draft, brand: e.target.value })}
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Barcode</Label>
                    <Input
                      value={draft.barcode}
                      onChange={e => setDraft({ ...draft, barcode: e.target.value })}
                      className="h-11 rounded-2xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Serving size *</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draft.servingSize}
                      onChange={e => setDraft({ ...draft, servingSize: parseFloat(e.target.value) || 0 })}
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Unit</Label>
                    <Input
                      value={draft.servingUnit}
                      onChange={e => setDraft({ ...draft, servingUnit: e.target.value })}
                      className="h-11 rounded-2xl"
                      placeholder="g"
                    />
                  </div>
                </div>

                {/* Nutrient sections */}
                {(Object.entries(NUTRIENT_CATEGORIES) as [string, readonly string[]][]).map(([category, keys]) => (
                  <div key={category} className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground capitalize">
                      {category} <span className="opacity-50 normal-case">(per serving)</span>
                    </Label>
                    <div className="space-y-1.5">
                      {keys.map(key => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="flex-1 text-[13px] truncate">{NUTRIENT_LABELS[key] ?? key}</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={draft.nutrients[key] ?? ''}
                            onChange={e => updateNutrient(key, e.target.value)}
                            placeholder="0"
                            className="h-9 w-24 rounded-xl text-right"
                          />
                          <span className="text-[11px] text-muted-foreground w-10">{NUTRIENT_UNITS[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="px-5 py-3 border-t border-border/30 flex gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} className="flex-1 h-11 rounded-2xl gap-1.5">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={saveDraft} className="ios-button-primary flex-1 h-11 gap-1.5">
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
