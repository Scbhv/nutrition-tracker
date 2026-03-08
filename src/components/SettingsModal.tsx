import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  UserSettings,
  NUTRIENT_LABELS,
  NUTRIENT_UNITS,
  NutrientData,
  Weekday,
  WEEKDAY_LABELS,
} from '@/types/nutrients';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: Partial<UserSettings>) => void;
}

const COMMON_GOALS = [
  'energy-kcal', 'proteins', 'carbohydrates', 'fat', 'fiber', 'water',
  'sodium', 'potassium', 'calcium', 'vitamin-c', 'vitamin-d', 'iron',
];

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun display order

export function SettingsModal({ open, onClose, settings, onSave }: SettingsModalProps) {
  const [goals, setGoals] = useState<NutrientData>(settings.dailyGoals);
  const [servingSize, setServingSize] = useState(settings.defaultServingSize.toString());
  const [weekdayEnabled, setWeekdayEnabled] = useState(settings.weekdayGoalsEnabled ?? false);
  const [weekdayGoals, setWeekdayGoals] = useState<Partial<Record<Weekday, NutrientData>>>(
    settings.weekdayGoals ?? {}
  );
  const [selectedDay, setSelectedDay] = useState<Weekday | null>(null);

  const handleSave = () => {
    onSave({
      defaultServingSize: parseFloat(servingSize) || 100,
      dailyGoals: goals,
      weekdayGoalsEnabled: weekdayEnabled,
      weekdayGoals: weekdayEnabled ? weekdayGoals : undefined,
    });
    onClose();
  };

  const updateGoal = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setGoals(prev => ({ ...prev, [key]: numValue }));
    }
  };

  const updateWeekdayGoal = (day: Weekday, key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setWeekdayGoals(prev => ({
        ...prev,
        [day]: { ...(prev[day] || {}), [key]: numValue },
      }));
    }
  };

  const getEffectiveGoal = (day: Weekday, key: string): string => {
    const override = weekdayGoals[day]?.[key as keyof NutrientData];
    if (override !== undefined) return String(override);
    return String(goals[key as keyof NutrientData] ?? '');
  };

  const copyDefaultsToDay = (day: Weekday) => {
    setWeekdayGoals(prev => ({ ...prev, [day]: { ...goals } }));
  };

  const clearDayOverrides = (day: Weekday) => {
    setWeekdayGoals(prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  };

  const hasDayOverrides = (day: Weekday) => {
    return weekdayGoals[day] && Object.keys(weekdayGoals[day]!).length > 0;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 gap-0 bg-card border-border rounded-3xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[55vh] px-6">
          <div className="space-y-6 pb-4">
            {/* Default Serving */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Default Serving (g)</Label>
              <Input
                type="number"
                value={servingSize}
                onChange={e => setServingSize(e.target.value)}
                min="1"
                className="bg-secondary border-0 rounded-xl"
              />
            </div>

            {/* Default Daily Goals */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Default Daily Goals
              </h3>
              <div className="space-y-3">
                {COMMON_GOALS.map(key => (
                  <div key={key} className="flex items-center gap-4">
                    <Label className="flex-1 text-sm">{NUTRIENT_LABELS[key]}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={goals[key as keyof NutrientData] ?? ''}
                        onChange={e => updateGoal(key, e.target.value)}
                        className="w-24 text-right bg-secondary border-0 rounded-xl"
                        min="0"
                      />
                      <span className="text-sm text-muted-foreground w-10">
                        {NUTRIENT_UNITS[key]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekday Goals Toggle */}
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Weekday-Specific Goals</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set different targets for each day
                  </p>
                </div>
                <Switch
                  checked={weekdayEnabled}
                  onCheckedChange={setWeekdayEnabled}
                />
              </div>

              {weekdayEnabled && (
                <div className="space-y-4 animate-fade-in">
                  {/* Day selector pills */}
                  <div className="flex gap-1.5">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-semibold transition-all relative",
                          selectedDay === day
                            ? "bg-primary text-primary-foreground"
                            : hasDayOverrides(day)
                              ? "bg-primary/20 text-primary"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {WEEKDAY_LABELS[day]}
                        {hasDayOverrides(day) && selectedDay !== day && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Selected day editor */}
                  {selectedDay !== null && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          {WEEKDAY_LABELS[selectedDay]} overrides
                        </p>
                        <div className="flex gap-2">
                          {!hasDayOverrides(selectedDay) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyDefaultsToDay(selectedDay)}
                              className="h-7 text-xs text-muted-foreground"
                            >
                              Copy defaults
                            </Button>
                          )}
                          {hasDayOverrides(selectedDay) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearDayOverrides(selectedDay)}
                              className="h-7 text-xs text-destructive"
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {hasDayOverrides(selectedDay)
                          ? 'Custom values shown. Empty fields use defaults.'
                          : 'No overrides set — using default goals. Tap "Copy defaults" to start customizing.'}
                      </p>

                      {hasDayOverrides(selectedDay) && (
                        <div className="space-y-3">
                          {COMMON_GOALS.map(key => {
                            const hasOverride = weekdayGoals[selectedDay]?.[key as keyof NutrientData] !== undefined;
                            return (
                              <div key={key} className="flex items-center gap-4">
                                <Label className={cn(
                                  "flex-1 text-sm",
                                  hasOverride ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  {NUTRIENT_LABELS[key]}
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={getEffectiveGoal(selectedDay, key)}
                                    onChange={e => updateWeekdayGoal(selectedDay, key, e.target.value)}
                                    className={cn(
                                      "w-24 text-right border-0 rounded-xl",
                                      hasOverride ? "bg-primary/10" : "bg-secondary"
                                    )}
                                    min="0"
                                    placeholder={String(goals[key as keyof NutrientData] ?? '')}
                                  />
                                  <span className="text-sm text-muted-foreground w-10">
                                    {NUTRIENT_UNITS[key]}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-3 p-6 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1 ios-button-secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 ios-button-primary">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
