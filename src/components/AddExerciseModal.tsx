import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Flame, Clock, Dumbbell } from 'lucide-react';

interface AddExerciseModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, caloriesBurned: number, durationMinutes?: number) => void;
}

const QUICK_EXERCISES = [
  { name: 'Walking', calsPerMin: 4, icon: '🚶' },
  { name: 'Running', calsPerMin: 11, icon: '🏃' },
  { name: 'Cycling', calsPerMin: 8, icon: '🚴' },
  { name: 'Swimming', calsPerMin: 9, icon: '🏊' },
  { name: 'Weight Training', calsPerMin: 6, icon: '🏋️' },
  { name: 'Yoga', calsPerMin: 3, icon: '🧘' },
];

export function AddExerciseModal({ open, onClose, onAdd }: AddExerciseModalProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedQuick, setSelectedQuick] = useState<typeof QUICK_EXERCISES[0] | null>(null);

  const handleQuickSelect = (exercise: typeof QUICK_EXERCISES[0]) => {
    setSelectedQuick(exercise);
    setName(exercise.name);
    if (duration) {
      setCalories(String(Math.round(exercise.calsPerMin * parseInt(duration))));
    }
  };

  const handleDurationChange = (val: string) => {
    setDuration(val);
    if (selectedQuick && val) {
      setCalories(String(Math.round(selectedQuick.calsPerMin * parseInt(val))));
    }
  };

  const handleAdd = () => {
    const cals = parseFloat(calories);
    if (!name.trim() || isNaN(cals) || cals <= 0) return;
    onAdd(name.trim(), cals, duration ? parseInt(duration) : undefined);
    resetAndClose();
  };

  const resetAndClose = () => {
    setName('');
    setCalories('');
    setDuration('');
    setSelectedQuick(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-md p-0 gap-0 bg-card border-border rounded-3xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive" />
            Log Exercise
          </DialogTitle>
          <DialogDescription className="sr-only">Log a workout or exercise session</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Quick exercise presets */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Quick Select
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_EXERCISES.map(ex => (
                <button
                  key={ex.name}
                  onClick={() => handleQuickSelect(ex)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all text-center ${
                    selectedQuick?.name === ex.name
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-lg">{ex.icon}</span>
                  <span className="text-xs font-medium leading-tight">{ex.name}</span>
                  <span className="text-[10px] opacity-70">{ex.calsPerMin} cal/min</span>
                </button>
              ))}
            </div>
          </div>

          {/* Exercise name */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Exercise Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Morning jog"
              className="bg-secondary border-0 rounded-xl"
            />
          </div>

          {/* Duration & Calories */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Duration (min)
              </Label>
              <Input
                type="number"
                value={duration}
                onChange={e => handleDurationChange(e.target.value)}
                placeholder="30"
                min="1"
                className="bg-secondary border-0 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" />
                Calories Burned
              </Label>
              <Input
                type="number"
                value={calories}
                onChange={e => setCalories(e.target.value)}
                placeholder="200"
                min="1"
                className="bg-secondary border-0 rounded-xl"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={resetAndClose} className="flex-1 ios-button-secondary">
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!name.trim() || !calories || parseFloat(calories) <= 0}
              className="flex-1 ios-button-primary"
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Log Exercise
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
