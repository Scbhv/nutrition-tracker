import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Check, Download, X, Palette, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/errorLog';
import { useThemePack, type AppliedThemePack } from '@/hooks/useThemePack';
import { cn } from '@/lib/utils';

interface ThemePackRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  accent_hue: number;
  background_path: string | null;
  card_path: string | null;
  button_path: string | null;
  accent_path: string | null;
  is_published: boolean;
  downloads: number;
  created_at: string;
}

type Surface = 'background' | 'card' | 'button' | 'accent';
type Sort = 'popular' | 'newest';

const SURFACE_LABELS: Record<Surface, string> = {
  background: 'Background',
  card: 'Card',
  button: 'Button',
  accent: 'Accent',
};

const publicUrl = (path?: string | null) =>
  path ? supabase.storage.from('theme-packs').getPublicUrl(path).data.publicUrl : undefined;

const toApplied = (r: ThemePackRow): AppliedThemePack => ({
  id: r.id,
  name: r.name,
  accentHue: r.accent_hue,
  backgroundUrl: publicUrl(r.background_path),
  cardUrl: publicUrl(r.card_path),
  buttonUrl: publicUrl(r.button_path),
  accentUrl: publicUrl(r.accent_path),
});

const hueBucket = (h: number) => {
  if (h < 20 || h >= 340) return 'red';
  if (h < 50) return 'orange';
  if (h < 80) return 'yellow';
  if (h < 170) return 'green';
  if (h < 210) return 'teal';
  if (h < 260) return 'blue';
  if (h < 310) return 'purple';
  return 'pink';
};
const HUE_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'red', label: 'Red' },
  { id: 'orange', label: 'Orange' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'teal', label: 'Teal' },
  { id: 'blue', label: 'Blue' },
  { id: 'purple', label: 'Purple' },
  { id: 'pink', label: 'Pink' },
];

export function ThemePackLibrary() {
  const { toast } = useToast();
  const { active, apply } = useThemePack();
  const [packs, setPacks] = useState<ThemePackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [surfaceFilters, setSurfaceFilters] = useState<Set<Surface>>(new Set());
  const [hueFilter, setHueFilter] = useState('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [preview, setPreview] = useState<ThemePackRow | null>(null);

  useEffect(() => { (async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('theme_packs')
        .select('*')
        .eq('is_published', true)
        .limit(200);
      if (error) throw error;
      setPacks((data ?? []) as ThemePackRow[]);
    } catch (e) {
      logError('theme-packs:library', e);
      toast({ title: 'Failed to load library', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  })(); }, [toast]);

  const toggleSurface = (s: Surface) => {
    const next = new Set(surfaceFilters);
    next.has(s) ? next.delete(s) : next.add(s);
    setSurfaceFilters(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = packs.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q)) return false;
      if (hueFilter !== 'all' && hueBucket(p.accent_hue) !== hueFilter) return false;
      for (const s of surfaceFilters) {
        const col = `${s}_path` as const;
        if (!p[col]) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) =>
      sort === 'popular' ? b.downloads - a.downloads : +new Date(b.created_at) - +new Date(a.created_at)
    );
    return list;
  }, [packs, query, hueFilter, surfaceFilters, sort]);

  const applyPack = async (p: ThemePackRow) => {
    apply(toApplied(p));
    await supabase.from('theme_packs').update({ downloads: p.downloads + 1 }).eq('id', p.id);
    toast({ title: `Applied "${p.name}"` });
    setPreview(null);
  };

  const filterCount = surfaceFilters.size + (hueFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search packs…"
            className="pl-9 h-10 rounded-xl"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant={filterCount ? 'default' : 'outline'}
          size="icon"
          className="h-10 w-10 rounded-xl relative"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-3 p-3 rounded-xl bg-secondary/50 animate-fade-in">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Sort</p>
            <div className="grid grid-cols-2 gap-1 p-1 bg-background rounded-lg">
              {(['popular', 'newest'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn('h-7 rounded-md text-xs font-medium capitalize',
                    sort === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                >{s}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Includes surfaces</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SURFACE_LABELS) as Surface[]).map((s) => {
                const on = surfaceFilters.has(s);
                return (
                  <button key={s} onClick={() => toggleSurface(s)}
                    className={cn('px-2.5 h-7 text-xs rounded-full border transition-colors',
                      on ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground')}>
                    {SURFACE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Accent color</p>
            <div className="flex flex-wrap gap-1.5">
              {HUE_FILTERS.map((h) => (
                <button key={h.id} onClick={() => setHueFilter(h.id)}
                  className={cn('px-2.5 h-7 text-xs rounded-full border transition-colors',
                    hueFilter === h.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground')}>
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 space-y-1">
          <p className="text-sm text-muted-foreground">No packs match your filters.</p>
          {(query || filterCount > 0) && (
            <button onClick={() => { setQuery(''); setSurfaceFilters(new Set()); setHueFilter('all'); }}
              className="text-xs text-primary">Clear filters</button>
          )}
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">{filtered.length} pack{filtered.length === 1 ? '' : 's'}</p>
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((p) => {
              const thumb = publicUrl(p.background_path) ?? publicUrl(p.card_path);
              const isActive = active?.id === p.id;
              return (
                <button key={p.id} onClick={() => setPreview(p)}
                  className="text-left rounded-2xl overflow-hidden glass-card transition-transform active:scale-[0.97]">
                  <div className="aspect-square w-full relative"
                       style={{ background: thumb ? `url("${thumb}") center/cover` : `hsl(${p.accent_hue} 76% 46% / 0.3)` }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    {isActive && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                      <p className="text-xs font-semibold truncate flex-1">{p.name}</p>
                      <span className="w-4 h-4 rounded-full border border-foreground/30 shrink-0"
                        style={{ backgroundColor: `hsl(${p.accent_hue} 76% 46%)` }} />
                    </div>
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Download className="h-2.5 w-2.5" />{p.downloads}</span>
                    <span className="flex gap-0.5">
                      {(['background', 'card', 'button', 'accent'] as Surface[]).map((s) => (
                        <span key={s} className={cn('w-1.5 h-1.5 rounded-full', p[`${s}_path`] ? 'bg-primary' : 'bg-border')} />
                      ))}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Preview modal */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogTitle className="sr-only">{preview?.name ?? 'Theme pack preview'}</DialogTitle>
          {preview && (() => {
            const p = preview;
            const bg = publicUrl(p.background_path);
            const card = publicUrl(p.card_path);
            const isActive = active?.id === p.id;
            return (
              <>
                <div className="relative h-48 w-full"
                     style={{ background: bg ? `url("${bg}") center/cover` : `hsl(${p.accent_hue} 76% 46% / 0.3)` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="text-lg font-bold">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-4">
                  {/* Mock UI preview */}
                  <div className="rounded-2xl p-3 space-y-2 border border-border"
                       style={{ backgroundImage: card ? `url("${card}")` : undefined, backgroundSize: 'cover', backgroundBlendMode: 'overlay', backgroundColor: 'hsl(var(--card))' }}>
                    <p className="text-xs text-muted-foreground">Card preview</p>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">1,840</div>
                      <Palette className="h-5 w-5" style={{ color: `hsl(${p.accent_hue} 76% 46%)` }} />
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: '64%', backgroundColor: `hsl(${p.accent_hue} 76% 46%)` }} />
                    </div>
                  </div>
                  {/* Surface chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(SURFACE_LABELS) as Surface[]).map((s) => {
                      const has = !!p[`${s}_path`];
                      return (
                        <span key={s} className={cn('px-2 h-6 inline-flex items-center text-[11px] rounded-full',
                          has ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground line-through')}>
                          {SURFACE_LABELS[s]}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Download className="h-3 w-3" />{p.downloads} applied</span>
                    <span>Hue {p.accent_hue}°</span>
                  </div>
                  <Button onClick={() => applyPack(p)} disabled={isActive} className="w-full h-11 rounded-xl">
                    {isActive ? <><Check className="h-4 w-4 mr-1" />Already Applied</> : 'Apply Pack'}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
