import { useEffect, useState, useCallback } from 'react';
import { Plus, Check, Image as ImageIcon, Trash2, ShieldCheck, Clock, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FoodItem, NutrientData } from '@/types/nutrients';

interface CommunityFood {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_size: number;
  serving_unit: string;
  nutrients: NutrientData;
  image_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approval_count: number;
  created_at: string;
}

interface Props {
  onImportToLibrary: (food: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const PHOTO_BUCKET = 'community-food-photos';

function publicPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function CommunityFoodTab({ onImportToLibrary }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<CommunityFood[]>([]);
  const [approvedByMe, setApprovedByMe] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [tab, setTab] = useState<'approved' | 'pending'>('approved');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;
    setUserId(uid);

    const { data, error } = await supabase
      .from('community_foods')
      .select('*')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: 'Failed to load community foods', description: error.message, variant: 'destructive' });
    } else {
      setItems((data ?? []) as CommunityFood[]);
    }

    if (uid) {
      const { data: appr } = await supabase
        .from('community_food_approvals')
        .select('food_id')
        .eq('user_id', uid);
      setApprovedByMe(new Set((appr ?? []).map(a => a.food_id)));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const approve = async (food: CommunityFood) => {
    if (!userId) return;
    if (food.user_id === userId) {
      toast({ title: "You can't approve your own submission", variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('community_food_approvals')
      .insert({ food_id: food.id, user_id: userId });
    if (error) {
      toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Approved', description: food.name });
      load();
    }
  };

  const removeMine = async (food: CommunityFood) => {
    const { error } = await supabase.from('community_foods').delete().eq('id', food.id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else load();
  };

  const importToLibrary = (food: CommunityFood) => {
    onImportToLibrary({
      name: food.name,
      brand: food.brand ?? undefined,
      barcode: food.barcode ?? undefined,
      servingSize: food.serving_size,
      servingUnit: food.serving_unit,
      nutrients: food.nutrients ?? {},
    });
    toast({ title: 'Added to your library', description: food.name });
  };

  const approved = items.filter(i => i.status === 'approved');
  const pending = items.filter(i => i.status === 'pending');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Community foods become public after 2 approvals from other users.
        </p>
        <Button size="sm" onClick={() => setSubmitOpen(true)} className="ios-button-primary rounded-full">
          <Plus className="h-4 w-4 mr-1" /> Submit
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'approved' | 'pending')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="approved" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Approved ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="h-4 w-4" /> Pending ({pending.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="mt-3">
          <ScrollArea className="h-[calc(100vh-440px)]">
            <div className="space-y-2 pr-2">
              {loading ? <Skeleton /> : approved.length === 0 ? (
                <Empty msg="No approved community foods yet." />
              ) : approved.map(f => (
                <CommunityCard
                  key={f.id} food={f} userId={userId}
                  approvedByMe={approvedByMe.has(f.id)}
                  onApprove={() => approve(f)}
                  onDelete={() => removeMine(f)}
                  onImport={() => importToLibrary(f)}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pending" className="mt-3">
          <ScrollArea className="h-[calc(100vh-440px)]">
            <div className="space-y-2 pr-2">
              {loading ? <Skeleton /> : pending.length === 0 ? (
                <Empty msg="Nothing waiting for review. Submit one!" />
              ) : pending.map(f => (
                <CommunityCard
                  key={f.id} food={f} userId={userId}
                  approvedByMe={approvedByMe.has(f.id)}
                  onApprove={() => approve(f)}
                  onDelete={() => removeMine(f)}
                  onImport={() => importToLibrary(f)}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <SubmitFoodModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={() => { setSubmitOpen(false); load(); }}
      />
    </div>
  );
}

function Skeleton() {
  return <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-10 text-muted-foreground text-sm">{msg}</div>;
}

function CommunityCard({
  food, userId, approvedByMe, onApprove, onDelete, onImport,
}: {
  food: CommunityFood;
  userId: string | null;
  approvedByMe: boolean;
  onApprove: () => void;
  onDelete: () => void;
  onImport: () => void;
}) {
  const isMine = userId && food.user_id === userId;
  const photo = publicPhotoUrl(food.image_path);
  const kcal = food.nutrients?.['energy-kcal'] ?? 0;

  return (
    <div className="glass-card rounded-2xl p-3 flex gap-3">
      <div className="w-16 h-16 rounded-xl bg-secondary overflow-hidden flex items-center justify-center shrink-0">
        {photo ? (
          <img src={photo} alt={food.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{food.name}</h4>
          {food.status === 'approved' ? (
            <Badge variant="secondary" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-0.5" />Approved</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">{food.approval_count}/2</Badge>
          )}
        </div>
        {food.brand && <p className="text-xs text-muted-foreground truncate">{food.brand}</p>}
        <p className="text-xs text-muted-foreground">{Math.round(Number(kcal))} kcal / 100g</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Button size="sm" variant="secondary" className="h-7 rounded-full text-xs" onClick={onImport}>
            <Download className="h-3 w-3 mr-1" /> Add to library
          </Button>
          {food.status === 'pending' && !isMine && (
            <Button
              size="sm"
              className="h-7 rounded-full text-xs ios-button-primary"
              onClick={onApprove}
              disabled={approvedByMe}
            >
              <Check className="h-3 w-3 mr-1" />
              {approvedByMe ? 'Approved by you' : 'Approve'}
            </Button>
          )}
          {isMine && (
            <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SubmitFoodModal({
  open, onClose, onSubmitted,
}: { open: boolean; onClose: () => void; onSubmitted: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(''); setBrand(''); setBarcode('');
    setServingSize('100'); setServingUnit('g');
    setKcal(''); setProtein(''); setCarbs(''); setFat('');
    setPhoto(null); setPhotoPreview(null);
  };

  const handlePhoto = (file: File | null) => {
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('You must be signed in');

      let imagePath: string | null = null;
      if (photo) {
        const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, {
          contentType: photo.type, upsert: false,
        });
        if (up.error) throw up.error;
        imagePath = path;
      }

      const nutrients: NutrientData = {};
      const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? undefined : n; };
      const k = num(kcal); if (k !== undefined) nutrients['energy-kcal'] = k;
      const p = num(protein); if (p !== undefined) nutrients['proteins'] = p;
      const c = num(carbs); if (c !== undefined) nutrients['carbohydrates'] = c;
      const f = num(fat); if (f !== undefined) nutrients['fat'] = f;

      const { error } = await supabase.from('community_foods').insert({
        user_id: uid,
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: barcode.trim() || null,
        serving_size: parseFloat(servingSize) || 100,
        serving_unit: servingUnit.trim() || 'g',
        nutrients,
        image_path: imagePath,
      });
      if (error) throw error;

      toast({ title: 'Submitted for review', description: 'Needs 2 approvals to go public.' });
      reset();
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submission failed';
      toast({ title: 'Submission failed', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Submit a food</DialogTitle>
          <DialogDescription className="text-xs">
            Will become public after 2 other users approve it.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Photo (optional)</Label>
              <div className="flex items-center gap-3">
                <label className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center cursor-pointer overflow-hidden">
                  {photoPreview ? (
                    <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                  <input
                    type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                {photo && (
                  <Button size="sm" variant="ghost" onClick={() => handlePhoto(null)}>Remove</Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
                className="bg-secondary border-0 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Brand</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Barcode</Label>
                <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Serving size</Label>
                <Input type="number" value={servingSize} onChange={(e) => setServingSize(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <Input value={servingUnit} onChange={(e) => setServingUnit(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2">Nutrients per 100{servingUnit || 'g'}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Calories (kcal)</Label>
                <Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Protein (g)</Label>
                <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Carbs (g)</Label>
                <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fat (g)</Label>
                <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} className="bg-secondary border-0 rounded-xl" />
              </div>
            </div>
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1 ios-button-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1 ios-button-primary" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
