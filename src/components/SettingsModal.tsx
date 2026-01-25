import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserSettings, NUTRIENT_LABELS, NUTRIENT_UNITS, NutrientData } from '@/types/nutrients';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: Partial<UserSettings>) => void;
}

const COMMON_GOALS = [
  'energy-kcal', 'proteins', 'carbohydrates', 'fat', 'fiber', 'water',
  'sodium', 'potassium', 'calcium', 'vitamin-c', 'vitamin-d', 'iron'
];

export function SettingsModal({ open, onClose, settings, onSave }: SettingsModalProps) {
  const [goals, setGoals] = useState<NutrientData>(settings.dailyGoals);
  const [servingSize, setServingSize] = useState(settings.defaultServingSize.toString());

  const handleSave = () => {
    onSave({
      defaultServingSize: parseFloat(servingSize) || 100,
      dailyGoals: goals,
    });
    onClose();
  };

  const updateGoal = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setGoals(prev => ({ ...prev, [key]: numValue }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] px-6">
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="servingSize">Default Serving Size (g)</Label>
              <Input
                id="servingSize"
                type="number"
                value={servingSize}
                onChange={e => setServingSize(e.target.value)}
                min="1"
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Daily Goals
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
                        className="w-24 text-right"
                        min="0"
                      />
                      <span className="text-sm text-muted-foreground w-12">
                        {NUTRIENT_UNITS[key]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
