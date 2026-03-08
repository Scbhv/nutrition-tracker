import { useRef } from 'react';
import { Sun, Moon, Monitor, Droplets, Palette } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  type ThemeMode,
  type DesignStyle,
  type AppearanceSettings as AppearanceSettingsType,
  PRESET_ICONS,
  ACCENT_PRESETS,
} from '@/hooks/useAppearance';

interface AppearanceSettingsProps {
  appearance: AppearanceSettingsType;
  onUpdate: (updates: Partial<AppearanceSettingsType>) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'auto', icon: Monitor, label: 'Auto' },
];

export function AppearanceSettings({ appearance, onUpdate }: AppearanceSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({ appIcon: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Theme Mode */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          Theme
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onUpdate({ themeMode: mode })}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                appearance.themeMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Design Style */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          Design Style
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { style: 'default' as DesignStyle, icon: Palette, label: 'Default' },
            { style: 'liquid-glass' as DesignStyle, icon: Droplets, label: 'Liquid Glass' },
          ]).map(({ style, icon: Icon, label }) => (
            <button
              key={style}
              onClick={() => onUpdate({ designStyle: style })}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                appearance.designStyle === style
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          Accent Color
        </Label>
        <div className="flex flex-wrap gap-3">
          {ACCENT_PRESETS.map(({ hue, label }) => (
            <button
              key={hue}
              onClick={() => onUpdate({ accentHue: hue })}
              title={label}
              className={`w-10 h-10 rounded-full transition-all border-2 ${
                appearance.accentHue === hue
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: `hsl(${hue}, 76%, 46%)` }}
            />
          ))}
        </div>
        {/* Custom hue slider */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Custom</span>
            <span className="text-xs text-muted-foreground">{appearance.accentHue}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={appearance.accentHue}
            onChange={(e) => onUpdate({ accentHue: parseInt(e.target.value) })}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, 
                hsl(0,76%,46%), hsl(60,76%,46%), hsl(120,76%,46%), 
                hsl(180,76%,46%), hsl(240,76%,46%), hsl(300,76%,46%), hsl(360,76%,46%))`,
            }}
          />
        </div>
      </div>

      {/* App Icon */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          App Icon
        </Label>
        <div className="flex flex-wrap gap-3">
          {PRESET_ICONS.map(({ id, emoji, label }) => (
            <button
              key={id}
              onClick={() => onUpdate({ appIcon: id })}
              title={label}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${
                appearance.appIcon === id
                  ? 'bg-primary/20 ring-2 ring-primary scale-110'
                  : 'bg-secondary hover:bg-muted hover:scale-105'
              }`}
            >
              {emoji}
            </button>
          ))}
          {/* Custom upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload custom icon"
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all overflow-hidden ${
              appearance.appIcon.startsWith('data:')
                ? 'ring-2 ring-primary scale-110'
                : 'bg-secondary hover:bg-muted hover:scale-105'
            }`}
          >
            {appearance.appIcon.startsWith('data:') ? (
              <img src={appearance.appIcon} alt="Custom" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">+</span>
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleIconUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
