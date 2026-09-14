import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Lock, Pencil, RotateCcw, Check } from 'lucide-react';
import { HighlightText } from '@/components/HighlightText';
import { UserSettings, NUTRIENT_UNITS } from '@/types/nutrients';
import { matchesKeywords } from '@/lib/settingsSearch';
import { recordHistory } from '@/lib/settingsHistory';
import { useToast } from '@/hooks/use-toast';

interface EditableField {
  key: string;
  label: string;
  unit?: string;
  keywords: string[];
  /** Goal nutrient key, or a top-level setting. */
  kind: 'goal' | 'serving' | 'weekday';
  premium?: boolean;
}

const FIELDS: EditableField[] = [
  { key: 'energy-kcal', label: 'Daily calories', unit: 'kcal', kind: 'goal', premium: true, keywords: ['calories', 'energy', 'kcal', 'goal', 'target'] },
  { key: 'proteins', label: 'Protein goal', unit: 'g', kind: 'goal', premium: true, keywords: ['protein', 'macros', 'goal'] },
  { key: 'carbohydrates', label: 'Carbohydrate goal', unit: 'g', kind: 'goal', premium: true, keywords: ['carbs', 'carbohydrates', 'macros', 'goal'] },
  { key: 'fat', label: 'Fat goal', unit: 'g', kind: 'goal', premium: true, keywords: ['fat', 'macros', 'goal'] },
  { key: 'fiber', label: 'Fiber goal', unit: 'g', kind: 'goal', premium: true, keywords: ['fiber', 'fibre', 'goal'] },
  { key: 'water', label: 'Water goal', unit: 'ml', kind: 'goal', premium: true, keywords: ['water', 'hydration', 'drink', 'goal'] },
  { key: 'defaultServingSize', label: 'Default serving size', unit: 'g', kind: 'serving', keywords: ['serving', 'portion', 'default', 'grams', 'size'] },
  { key: 'weekdayGoalsEnabled', label: 'Per-weekday goals', kind: 'weekday', premium: true, keywords: ['weekday', 'per day', 'goals', 'schedule'] },
];

interface SettingsEditorCardProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
  isPremium: boolean;
  onShowDonationGate: () => void;
  /** Current settings search query — filters and highlights the fields. */
  query?: string;
}

export function SettingsEditorCard({
  settings,
  onUpdate,
  isPremium,
  onShowDonationGate,
  query = '',
}: SettingsEditorCardProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [weekday, setWeekday] = useState(settings.weekdayGoalsEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const currentValue = (f: EditableField): string => {
    if (f.kind === 'serving') return String(settings.defaultServingSize ?? 100);
    if (f.kind === 'weekday') return String(settings.weekdayGoalsEnabled ?? false);
    const v = settings.dailyGoals?.[f.key as keyof typeof settings.dailyGoals];
    return v === undefined || v === null ? '' : String(v);
  };

  // Keep the draft in sync when settings change from elsewhere (e.g. an undo).
  useEffect(() => {
    setDraft({});
    setWeekday(settings.weekdayGoalsEnabled ?? false);
  }, [settings]);

  const visible = useMemo(
    () => FIELDS.filter((f) => !query || matchesKeywords(query, [f.label, ...f.keywords])),
    [query],
  );

  const errors: Record<string, string> = {};
  for (const f of visible) {
    if (f.kind === 'weekday') continue;
    const raw = draft[f.key];
    if (raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (Number.isNaN(n)) errors[f.key] = 'Enter a number';
    else if (n < 0) errors[f.key] = 'Must be 0 or more';
    else if (n > 100000) errors[f.key] = 'That looks too high';
  }

  const dirty =
    Object.keys(draft).some((k) => draft[k] !== currentValue(FIELDS.find((f) => f.key === k)!)) ||
    weekday !== (settings.weekdayGoalsEnabled ?? false);
  const hasErrors = Object.keys(errors).length > 0;

  if (visible.length === 0) return null;

  const handleSave = () => {
    if (!dirty || hasErrors || saving) return;
    setSaving(true);

    const before: Partial<UserSettings> = {
      dailyGoals: { ...settings.dailyGoals },
      defaultServingSize: settings.defaultServingSize,
      weekdayGoalsEnabled: settings.weekdayGoalsEnabled ?? false,
    };

    const nextGoals = { ...settings.dailyGoals };
    let nextServing = settings.defaultServingSize;
    const changed: string[] = [];

    for (const f of FIELDS) {
      const raw = draft[f.key];
      if (raw === undefined || raw === currentValue(f)) continue;
      if (f.kind === 'serving') {
        nextServing = Number(raw) || 100;
        changed.push(f.label);
      } else if (f.kind === 'goal') {
        (nextGoals as Record<string, number>)[f.key] = Number(raw);
        changed.push(f.label);
      }
    }
    if (weekday !== (settings.weekdayGoalsEnabled ?? false)) changed.push('Per-weekday goals');

    const updates: Partial<UserSettings> = {
      dailyGoals: nextGoals,
      defaultServingSize: nextServing,
      weekdayGoalsEnabled: weekday,
    };

    onUpdate(updates);
    recordHistory({
      kind: 'edit',
      title: changed.length === 1 ? `Edited ${changed[0]}` : `Edited ${changed.length} settings`,
      detail: changed.join(', '),
      undoHandler: 'settings',
      undoPayload: before,
    });

    setSaving(false);
    setJustSaved(true);
    setDraft({});
    toast({ title: 'Settings saved', description: changed.join(', ') });
    window.setTimeout(() => setJustSaved(false), 2000);
  };

  const locked = (f: EditableField) => !!f.premium && !isPremium;

  return (
    <div className="bg-card/60 backdrop-blur-2xl rounded-[20px] border border-border/30 shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Pencil className="h-4 w-4 text-primary shrink-0" />
        <p className="text-[14px] font-semibold tracking-tight">
          <HighlightText text="Edit settings" query={query} />
        </p>
        {query && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {visible.length} match{visible.length === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {visible.map((f) => {
          const isLocked = locked(f);
          if (f.kind === 'weekday') {
            return (
              <div key={f.key} className="flex items-center gap-3 min-h-[44px]">
                <span className="text-[14px] flex-1 min-w-0">
                  <HighlightText text={f.label} query={query} />
                </span>
                {isLocked ? (
                  <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={onShowDonationGate}>
                    <Lock className="h-3.5 w-3.5 mr-1.5" /> Unlock
                  </Button>
                ) : (
                  <Switch checked={weekday} onCheckedChange={setWeekday} aria-label={f.label} />
                )}
              </div>
            );
          }
          const value = draft[f.key] ?? currentValue(f);
          return (
            <div key={f.key} className="space-y-1">
              <div className="flex items-center gap-3">
                <label
                  htmlFor={`set-${f.key}`}
                  className="text-[14px] flex-1 min-w-0 truncate"
                >
                  <HighlightText text={f.label} query={query} />
                </label>
                {isLocked ? (
                  <Button size="sm" variant="outline" className="h-9 rounded-xl shrink-0" onClick={onShowDonationGate}>
                    <Lock className="h-3.5 w-3.5 mr-1.5" /> Unlock
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      id={`set-${f.key}`}
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      aria-invalid={!!errors[f.key]}
                      className="w-24 h-11 text-right rounded-xl"
                    />
                    <span className="text-[12px] text-muted-foreground w-8">
                      {f.unit ?? NUTRIENT_UNITS[f.key as keyof typeof NUTRIENT_UNITS] ?? ''}
                    </span>
                  </div>
                )}
              </div>
              {errors[f.key] && (
                <p className="text-[12px] text-destructive text-right">{errors[f.key]}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
        <Button
          onClick={handleSave}
          disabled={!dirty || hasErrors || saving}
          className="h-12 rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : justSaved ? (
            <Check className="h-4 w-4 mr-2" />
          ) : null}
          {justSaved && !dirty ? 'Saved' : 'Save changes'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDraft({});
            setWeekday(settings.weekdayGoalsEnabled ?? false);
          }}
          disabled={!dirty}
          className="h-12 rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Discard
        </Button>
      </div>
    </div>
  );
}
