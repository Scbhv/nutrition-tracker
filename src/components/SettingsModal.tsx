import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Beaker, Lock } from 'lucide-react';
import { DonationGateModal } from '@/components/DonationGateModal';
import { cn } from '@/lib/utils';
import {
  UserSettings,
  NUTRIENT_LABELS,
  NUTRIENT_UNITS,
  NutrientData,
  Weekday,
  WEEKDAY_LABELS,
  CustomNutrient,
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

const UNIT_OPTIONS = ['g', 'mg', 'μg', 'ml', 'IU', 'kcal', 'mcg', 'oz', 'cups'];

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

// Validation
const MAX_NUTRIENT_NAME = 50;
const MAX_UNIT_LENGTH = 10;
const SAFE_TEXT = /^[a-zA-Z0-9\s\-_()./]+$/;

function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function SettingsModal({ open, onClose, settings, onSave }: SettingsModalProps) {
  const [goals, setGoals] = useState<NutrientData>(settings.dailyGoals);
  const [servingSize, setServingSize] = useState(settings.defaultServingSize.toString());
  const [weekdayEnabled, setWeekdayEnabled] = useState(settings.weekdayGoalsEnabled ?? false);
  const [weekdayGoals, setWeekdayGoals] = useState<Partial<Record<Weekday, NutrientData>>>(
    settings.weekdayGoals ?? {}
  );
  const [selectedDay, setSelectedDay] = useState<Weekday | null>(null);
  const [customNutrients, setCustomNutrients] = useState<CustomNutrient[]>(
    settings.customNutrients ?? []
  );

  // New custom nutrient form state
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('mg');
  const [newGoal, setNewGoal] = useState('');
  const [customError, setCustomError] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [showDonationGate, setShowDonationGate] = useState(false);
  const goalsLocked = true; // Goals are locked until donation
  const handleSave = () => {
    onSave({
      defaultServingSize: parseFloat(servingSize) || 100,
      dailyGoals: goals,
      weekdayGoalsEnabled: weekdayEnabled,
      weekdayGoals: weekdayEnabled ? weekdayGoals : undefined,
      customNutrients,
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

  // Custom nutrient management
  const handleAddCustomNutrient = () => {
    setCustomError('');
    const trimmedName = newName.trim();

    if (!trimmedName) {
      setCustomError('Name is required');
      return;
    }
    if (trimmedName.length > MAX_NUTRIENT_NAME) {
      setCustomError(`Name must be ${MAX_NUTRIENT_NAME} characters or less`);
      return;
    }
    if (!SAFE_TEXT.test(trimmedName)) {
      setCustomError('Name contains invalid characters');
      return;
    }
    if (newUnit.trim().length > MAX_UNIT_LENGTH) {
      setCustomError(`Unit must be ${MAX_UNIT_LENGTH} characters or less`);
      return;
    }

    const goalNum = parseFloat(newGoal);
    if (isNaN(goalNum) || goalNum <= 0) {
      setCustomError('Goal must be a positive number');
      return;
    }

    const id = `custom-${toKebabCase(trimmedName)}`;

    // Check for duplicates
    const allKeys = [...Object.keys(NUTRIENT_LABELS), ...customNutrients.map(n => n.id)];
    if (allKeys.includes(id)) {
      setCustomError('A nutrient with this name already exists');
      return;
    }

    const nutrient: CustomNutrient = {
      id,
      label: trimmedName,
      unit: newUnit.trim() || 'mg',
      goal: goalNum,
    };

    setCustomNutrients(prev => [...prev, nutrient]);
    setGoals(prev => ({ ...prev, [id]: goalNum }));
    setNewName('');
    setNewUnit('mg');
    setNewGoal('');
    setShowAddCustom(false);
  };

  const removeCustomNutrient = (id: string) => {
    setCustomNutrients(prev => prev.filter(n => n.id !== id));
    setGoals(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Build the goals list including custom nutrients
  const allGoalKeys = [...COMMON_GOALS, ...customNutrients.map(n => n.id)];

  const getLabel = (key: string) => {
    const custom = customNutrients.find(n => n.id === key);
    return custom?.label || NUTRIENT_LABELS[key] || key;
  };

  const getUnit = (key: string) => {
    const custom = customNutrients.find(n => n.id === key);
    return custom?.unit || NUTRIENT_UNITS[key] || '';
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Daily Goals
                </h3>
                {goalsLocked && (
                  <button
                    onClick={() => setShowDonationGate(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Lock className="h-3 w-3" />
                    Unlock
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {allGoalKeys.map(key => {
                  const isCustom = customNutrients.some(n => n.id === key);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3"
                      onClick={goalsLocked ? () => setShowDonationGate(true) : undefined}
                    >
                      <Label className={cn("flex-1 text-sm truncate", goalsLocked && "opacity-50")}>
                        {isCustom && (
                          <Beaker className="inline h-3.5 w-3.5 mr-1.5 text-accent opacity-70" />
                        )}
                        {getLabel(key)}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={goals[key as keyof NutrientData] ?? ''}
                          onChange={e => updateGoal(key, e.target.value)}
                          className={cn(
                            "w-24 text-right bg-secondary border-0 rounded-xl",
                            goalsLocked && "opacity-50 cursor-not-allowed"
                          )}
                          min="0"
                          disabled={goalsLocked}
                        />
                        <span className={cn("text-sm text-muted-foreground w-10", goalsLocked && "opacity-50")}>
                          {getUnit(key)}
                        </span>
                        {isCustom && !goalsLocked && (
                          <button
                            onClick={() => removeCustomNutrient(key)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Remove custom nutrient"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add Custom Nutrient */}
            <div className={cn("glass-card rounded-2xl p-4 space-y-3 relative", goalsLocked && "opacity-50")} onClick={goalsLocked ? () => setShowDonationGate(true) : undefined}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Beaker className="h-4 w-4 text-accent" />
                    Custom Nutrients
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Track anything not in the default list
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowAddCustom(!showAddCustom); setCustomError(''); }}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {showAddCustom && (
                <div className="space-y-3 animate-fade-in pt-1">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Nutrient Name</Label>
                    <Input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="e.g. Omega-3, Collagen, CoQ10"
                      className="bg-secondary border-0 rounded-xl"
                      maxLength={MAX_NUTRIENT_NAME}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {UNIT_OPTIONS.map(u => (
                          <button
                            key={u}
                            onClick={() => setNewUnit(u)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                              newUnit === u
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Daily Goal</Label>
                      <Input
                        type="number"
                        value={newGoal}
                        onChange={e => setNewGoal(e.target.value)}
                        placeholder="Amount"
                        min="0"
                        className="bg-secondary border-0 rounded-xl"
                      />
                    </div>
                  </div>

                  {customError && (
                    <p className="text-xs text-destructive">{customError}</p>
                  )}

                  <Button
                    onClick={handleAddCustomNutrient}
                    className="w-full ios-button-primary h-10"
                    disabled={!newName.trim() || !newGoal}
                  >
                    Add Nutrient
                  </Button>
                </div>
              )}

              {customNutrients.length > 0 && !showAddCustom && (
                <div className="space-y-1.5 pt-1">
                  {customNutrients.map(n => (
                    <div key={n.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-secondary/50">
                      <span className="text-sm font-medium text-foreground">{n.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {n.goal} {n.unit}/day
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekday Goals Toggle */}
            <div className={cn("glass-card rounded-2xl p-4 space-y-4 relative", goalsLocked && "opacity-50")} onClick={goalsLocked ? () => setShowDonationGate(true) : undefined}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Weekday-Specific Goals</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set different targets for each day
                  </p>
                </div>
                <Switch
                  checked={weekdayEnabled}
                  onCheckedChange={goalsLocked ? () => setShowDonationGate(true) : setWeekdayEnabled}
                  disabled={goalsLocked}
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
                          {allGoalKeys.map(key => {
                            const hasOverride = weekdayGoals[selectedDay]?.[key as keyof NutrientData] !== undefined;
                            return (
                              <div key={key} className="flex items-center gap-4">
                                <Label className={cn(
                                  "flex-1 text-sm",
                                  hasOverride ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  {getLabel(key)}
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
                                    {getUnit(key)}
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
      <DonationGateModal open={showDonationGate} onClose={() => setShowDonationGate(false)} />
    </Dialog>
  );
}
