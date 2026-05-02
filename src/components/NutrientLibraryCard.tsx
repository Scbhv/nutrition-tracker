import { useMemo, useRef, useState } from 'react';
import { BookOpen, Sparkles, Download, Upload, Globe, Loader2, Check, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { FoodItem } from '@/types/nutrients';
import seedFoodsRaw from '@/data/seedFoods.json';
import {
  parseNutrientLibrary,
  buildExportLibrary,
  fetchRemoteLibrary,
  libraryEntryToFoodItem,
  SEED_LOADED_KEY,
  type NutrientLibrary,
} from '@/lib/nutrientLibrary';

interface NutrientLibraryCardProps {
  foods: FoodItem[];
  /** Merge new foods into the user's database, skipping duplicates by id/barcode. */
  mergeFoods: (foods: FoodItem[]) => void;
}

const seedLibrary = parseNutrientLibrary(JSON.stringify(seedFoodsRaw));

export function NutrientLibraryCard({ foods, mergeFoods }: NutrientLibraryCardProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [preview, setPreview] = useState<{ source: string; library: NutrientLibrary; foods: FoodItem[] } | null>(
    null,
  );
  const seedLoaded = typeof window !== 'undefined' && localStorage.getItem(SEED_LOADED_KEY) === '1';
  const seedFoodCount = seedLibrary.success ? seedLibrary.foods.length : 0;

  const existingNames = useMemo(
    () => new Set(foods.map(f => `${f.name.toLowerCase()}|${f.brand?.toLowerCase() ?? ''}`)),
    [foods],
  );

  const countNew = (incoming: FoodItem[]) =>
    incoming.filter(f => !existingNames.has(`${f.name.toLowerCase()}|${f.brand?.toLowerCase() ?? ''}`)).length;

  const handleLoadSeed = () => {
    if (!seedLibrary.success) {
      const err = 'error' in seedLibrary ? seedLibrary.error : 'Unknown error';
      toast({ title: 'Seed catalog unavailable', description: err, variant: 'destructive' });
      return;
    }
    const newCount = countNew(seedLibrary.foods);
    mergeFoods(seedLibrary.foods);
    localStorage.setItem(SEED_LOADED_KEY, '1');
    toast({
      title: 'Starter catalog loaded',
      description: `Added ${newCount} new foods (${seedLibrary.foods.length - newCount} already existed).`,
    });
  };

  const handleExport = () => {
    if (foods.length === 0) {
      toast({ title: 'Nothing to export', description: 'Your food library is empty.', variant: 'destructive' });
      return;
    }
    const json = buildExportLibrary(foods, 'My Nutrient Library');
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nutrient-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: 'Library exported', description: `${foods.length} foods saved as JSON.` });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const result = parseNutrientLibrary(text);
    if (result.success !== true) {
      toast({ title: 'Import failed', description: ('error' in result ? result.error : 'Invalid file'), variant: 'destructive' });
      return;
    }
    setPreview({ source: file.name, library: result.library, foods: result.foods });
  };

  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    const result = await fetchRemoteLibrary(url.trim());
    setFetching(false);
    if (result.success !== true) {
      toast({ title: 'Could not load library', description: ('error' in result ? result.error : 'Network error'), variant: 'destructive' });
      return;
    }
    setPreview({ source: url.trim(), library: result.library, foods: result.foods });
  };

  const handleApplyPreview = () => {
    if (!preview) return;
    const newCount = countNew(preview.foods);
    mergeFoods(preview.foods);
    toast({
      title: 'Library merged',
      description: `Added ${newCount} new foods from ${preview.library.name || preview.source}.`,
    });
    setPreview(null);
  };

  return (
    <section className="bg-card/60 backdrop-blur-2xl rounded-[20px] p-4 space-y-4 border border-border/30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] text-foreground tracking-tight">Nutrient Library</h3>
          <p className="text-[12px] text-muted-foreground/80 truncate">
            {foods.length} foods in your database
          </p>
        </div>
      </div>

      {/* Bundled seed catalog */}
      <div className="rounded-2xl bg-muted/30 border border-border/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium text-foreground">Starter catalog</span>
          {seedLoaded && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary ml-auto">
              <Check className="h-3 w-3" /> loaded
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {seedFoodCount} common everyday foods (fruits, grains, proteins, dairy) with macros per 100 g.
          Safe to load multiple times — duplicates are skipped.
        </p>
        <Button onClick={handleLoadSeed} variant="outline" className="w-full h-10 gap-2 rounded-2xl">
          <Plus className="h-4 w-4" />
          {seedLoaded ? 'Re-load starter catalog' : 'Load starter catalog'}
        </Button>
      </div>

      {/* Import / Export */}
      <div className="rounded-2xl bg-muted/30 border border-border/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium text-foreground">Foods JSON file</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Export just your foods as a portable <code className="text-foreground/80">.json</code> library, or
          import one from disk. (For full backups including logs &amp; settings, use Backup &amp; Restore.)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleExport} variant="outline" className="h-10 gap-2 rounded-2xl">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-10 gap-2 rounded-2xl">
            <Upload className="h-4 w-4" /> Import
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {/* External library URL */}
      <div className="rounded-2xl bg-muted/30 border border-border/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium text-foreground">Load from URL</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Paste the URL of a community-shared nutrient library (.json). You'll see a preview before merging.
        </p>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/foods.json"
            className="h-10 rounded-2xl text-[13px]"
            disabled={fetching}
          />
          <Button
            onClick={handleFetch}
            disabled={!url.trim() || fetching}
            className="ios-button-primary h-10 px-4 gap-2"
          >
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Preview pane */}
      {preview && (
        <div className="rounded-2xl bg-primary/5 border border-primary/30 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground truncate">
                {preview.library.name || 'Untitled library'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {preview.foods.length} foods · {countNew(preview.foods)} new · from {preview.source}
              </p>
            </div>
          </div>
          <ScrollArea className="h-32 rounded-xl bg-background/40 p-2">
            <ul className="text-[11px] space-y-0.5">
              {preview.foods.slice(0, 50).map((f, i) => (
                <li key={i} className="flex justify-between gap-2 text-muted-foreground">
                  <span className="truncate">{f.name}{f.brand ? ` · ${f.brand}` : ''}</span>
                  <span className="shrink-0 text-foreground/70">
                    {f.nutrients['energy-kcal'] ?? '–'} kcal
                  </span>
                </li>
              ))}
              {preview.foods.length > 50 && (
                <li className="text-muted-foreground/60 italic">…and {preview.foods.length - 50} more</li>
              )}
            </ul>
          </ScrollArea>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setPreview(null)} variant="outline" className="h-10 rounded-2xl">
              Cancel
            </Button>
            <Button onClick={handleApplyPreview} className="ios-button-primary h-10 gap-2">
              <Plus className="h-4 w-4" /> Merge {countNew(preview.foods)}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
