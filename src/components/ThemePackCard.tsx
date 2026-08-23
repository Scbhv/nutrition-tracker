import { useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Lock, Globe, EyeOff, Trash2, Check, Loader2, Palette, Download } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/errorLog';
import { useThemePack, type AppliedThemePack } from '@/hooks/useThemePack';
import { ThemePackLibrary } from '@/components/ThemePackLibrary';
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

type Slot = 'background' | 'card' | 'button' | 'accent';
const SLOTS: { key: Slot; label: string; col: keyof ThemePackRow & string }[] = [
  { key: 'background', label: 'Background', col: 'background_path' },
  { key: 'card',       label: 'Card',       col: 'card_path' },
  { key: 'button',     label: 'Button',     col: 'button_path' },
  { key: 'accent',     label: 'Accent',     col: 'accent_path' },
];
const MAX_BYTES = 4 * 1024 * 1024;

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

interface Props {
  isPremium: boolean;
  onShowDonationGate: () => void;
  highlightQuery?: string;
}

export function ThemePackCard({ isPremium, onShowDonationGate, highlightQuery = '' }: Props) {
  const { toast } = useToast();
  const { active, apply, clear } = useThemePack();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<'mine' | 'gallery' | 'create'>('gallery');
  const [mine, setMine] = useState<ThemePackRow[]>([]);
  const [gallery, setGallery] = useState<ThemePackRow[]>([]);
  const [loading, setLoading] = useState(false);

  // create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accentHue, setAccentHue] = useState(142);
  const [files, setFiles] = useState<Record<Slot, File | null>>({ background: null, card: null, button: null, accent: null });
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Record<Slot, HTMLInputElement | null>>({ background: null, card: null, button: null, accent: null });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const [g, m] = await Promise.all([
        supabase.from('theme_packs').select('*').eq('is_published', true).order('downloads', { ascending: false }).limit(50),
        userId ? supabase.from('theme_packs').select('*').eq('user_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (g.error) throw g.error;
      if (m.error) throw m.error;
      setGallery((g.data ?? []) as ThemePackRow[]);
      setMine((m.data ?? []) as ThemePackRow[]);
    } catch (e) {
      logError('theme-packs:list', e);
      toast({ title: 'Failed to load packs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [userId]);

  const pickFile = (slot: Slot) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Max 4MB per image', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    if (f && !f.type.startsWith('image/')) {
      toast({ title: 'Images only', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setFiles((s) => ({ ...s, [slot]: f }));
  };

  const handleCreate = async (publish: boolean) => {
    if (!isPremium) return onShowDonationGate();
    if (!userId) return;
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (!files.background && !files.card && !files.button && !files.accent) {
      toast({ title: 'Add at least one image', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const packId = crypto.randomUUID();
      const paths: Partial<Record<`${Slot}_path`, string>> = {};
      for (const { key, col } of SLOTS) {
        const f = files[key];
        if (!f) continue;
        const ext = (f.name.split('.').pop() || 'png').toLowerCase();
        const path = `${userId}/${packId}/${key}.${ext}`;
        const { error } = await supabase.storage.from('theme-packs').upload(path, f, { upsert: true, contentType: f.type });
        if (error) throw error;
        (paths as any)[col] = path;
      }
      const { error } = await supabase.from('theme_packs').insert({
        id: packId,
        user_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        accent_hue: accentHue,
        is_published: publish,
        ...paths,
      });
      if (error) throw error;
      toast({ title: publish ? 'Pack published' : 'Pack saved' });
      setName(''); setDescription(''); setAccentHue(142);
      setFiles({ background: null, card: null, button: null, accent: null });
      Object.values(inputs.current).forEach((i) => { if (i) i.value = ''; });
      setTab('mine');
      await refresh();
    } catch (e: any) {
      logError('theme-packs:create', e);
      toast({ title: 'Upload failed', description: e?.message ?? 'Try again', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const togglePublish = async (p: ThemePackRow) => {
    const { error } = await supabase.from('theme_packs').update({ is_published: !p.is_published }).eq('id', p.id);
    if (error) { logError('theme-packs:publish', error); toast({ title: 'Update failed', variant: 'destructive' }); return; }
    toast({ title: !p.is_published ? 'Published to gallery' : 'Made private' });
    refresh();
  };

  const remove = async (p: ThemePackRow) => {
    const paths = SLOTS.map(({ col }) => (p as any)[col]).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('theme-packs').remove(paths);
    const { error } = await supabase.from('theme_packs').delete().eq('id', p.id);
    if (error) { logError('theme-packs:delete', error); toast({ title: 'Delete failed', variant: 'destructive' }); return; }
    if (active?.id === p.id) clear();
    toast({ title: 'Pack deleted' });
    refresh();
  };

  const applyPack = async (p: ThemePackRow) => {
    apply(toApplied(p));
    if (p.user_id !== userId) {
      // increment downloads (best-effort, ignored if RLS denies)
      await supabase.from('theme_packs').update({ downloads: p.downloads + 1 }).eq('id', p.id);
    }
    toast({ title: `Applied "${p.name}"` });
  };

  const renderPack = (p: ThemePackRow, owned: boolean) => {
    const bg = publicUrl(p.background_path) ?? publicUrl(p.card_path);
    const isActive = active?.id === p.id;
    return (
      <div key={p.id} className="glass-card rounded-2xl overflow-hidden">
        <div
          className="h-24 w-full relative"
          style={{
            background: bg ? `url("${bg}") center/cover` : `hsl(${p.accent_hue} 76% 46% / 0.25)`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold">{p.name}</p>
              {p.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{p.description}</p>}
            </div>
            <div
              className="w-6 h-6 rounded-full border border-foreground/20"
              style={{ backgroundColor: `hsl(${p.accent_hue} 76% 46%)` }}
            />
          </div>
        </div>
        <div className="p-3 flex items-center gap-2">
          <Button size="sm" onClick={() => applyPack(p)} className="flex-1 h-9 rounded-xl" variant={isActive ? 'secondary' : 'default'}>
            {isActive ? <><Check className="h-4 w-4 mr-1" /> Active</> : <>Apply</>}
          </Button>
          {owned ? (
            <>
              <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => togglePublish(p)} title={p.is_published ? 'Unpublish' : 'Publish'}>
                {p.is_published ? <Globe className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl text-destructive" onClick={() => remove(p)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Download className="h-3 w-3" />{p.downloads}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Theme Packs</Label>
        </div>
        {active && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clear}>Reset</Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-secondary rounded-xl">
        {(['gallery', 'mine', 'create'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'h-8 rounded-lg text-xs font-medium capitalize transition-colors',
              tab === t ? 'bg-background text-foreground' : 'text-muted-foreground'
            )}
          >
            {t === 'create' && !isPremium ? <Lock className="h-3 w-3 inline mr-1" /> : null}
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

      {!loading && tab === 'gallery' && <ThemePackLibrary />}

      {!loading && tab === 'mine' && (
        !userId
          ? <p className="text-xs text-muted-foreground text-center py-6">Sign in to manage your packs.</p>
          : mine.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-6">You haven't created any packs.</p>
            : <div className="space-y-2">{mine.map((p) => renderPack(p, true))}</div>
      )}

      {tab === 'create' && (
        !isPremium ? (
          <button
            onClick={onShowDonationGate}
            className="w-full p-4 rounded-xl bg-secondary text-sm text-muted-foreground flex items-center justify-center gap-2"
          >
            <Lock className="h-4 w-4" /> Premium required to upload theme packs
          </button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Pack name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="My iOS Glow" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">Accent hue</Label>
                <span className="text-xs text-muted-foreground">{accentHue}°</span>
              </div>
              <input
                type="range" min={0} max={360} value={accentHue}
                onChange={(e) => setAccentHue(parseInt(e.target.value))}
                className="w-full h-2 rounded-full cursor-pointer"
                style={{ background: 'linear-gradient(to right, hsl(0,76%,46%), hsl(60,76%,46%), hsl(120,76%,46%), hsl(180,76%,46%), hsl(240,76%,46%), hsl(300,76%,46%), hsl(360,76%,46%))' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SLOTS.map(({ key, label }) => {
                const f = files[key];
                const preview = f ? URL.createObjectURL(f) : null;
                return (
                  <label key={key} className="cursor-pointer">
                    <div className="aspect-video rounded-xl border border-dashed border-border bg-secondary flex items-center justify-center overflow-hidden">
                      {preview
                        ? <img src={preview} alt={label} className="w-full h-full object-cover" />
                        : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <p className="text-[11px] mt-1 text-center text-muted-foreground">{label}{f ? ' ✓' : ''}</p>
                    <input
                      ref={(el) => { inputs.current[key] = el; }}
                      type="file" accept="image/*" className="hidden" onChange={pickFile(key)}
                    />
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">Max 4MB per image. Background is shown app-wide; card/button/accent overlay matching surfaces.</p>

            <div className="flex gap-2">
              <Button onClick={() => handleCreate(false)} disabled={submitting} variant="outline" className="flex-1 h-10 rounded-xl">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><EyeOff className="h-4 w-4 mr-1" />Save private</>}
              </Button>
              <Button onClick={() => handleCreate(true)} disabled={submitting} className="flex-1 h-10 rounded-xl">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1" />Publish</>}
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
