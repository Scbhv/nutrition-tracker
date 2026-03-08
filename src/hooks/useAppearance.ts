import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light' | 'auto';
export type DesignStyle = 'default' | 'liquid-glass';

export interface AppearanceSettings {
  themeMode: ThemeMode;
  designStyle: DesignStyle;
  accentHue: number; // 0-360
  appIcon: string; // icon id or data URL
}

const STORAGE_KEY = 'nutrient-tracker-appearance';

const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeMode: 'dark',
  designStyle: 'default',
  accentHue: 142, // green
  appIcon: 'default',
};

export const PRESET_ICONS = [
  { id: 'default', emoji: '🍎', label: 'Apple' },
  { id: 'leaf', emoji: '🥬', label: 'Greens' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'heart', emoji: '💚', label: 'Heart' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'bolt', emoji: '⚡', label: 'Energy' },
  { id: 'muscle', emoji: '💪', label: 'Muscle' },
  { id: 'salad', emoji: '🥗', label: 'Salad' },
];

export const ACCENT_PRESETS = [
  { hue: 142, label: 'Green' },
  { hue: 210, label: 'Blue' },
  { hue: 280, label: 'Purple' },
  { hue: 340, label: 'Pink' },
  { hue: 25, label: 'Orange' },
  { hue: 45, label: 'Yellow' },
  { hue: 0, label: 'Red' },
  { hue: 175, label: 'Teal' },
];

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'auto' ? getSystemTheme() : mode;
  document.documentElement.classList.toggle('light', resolved === 'light');
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  return resolved;
}

function applyAccentHue(hue: number) {
  const root = document.documentElement;
  root.style.setProperty('--primary', `${hue} 76% 46%`);
  root.style.setProperty('--ring', `${hue} 76% 46%`);
  root.style.setProperty('--sidebar-primary', `${hue} 76% 46%`);
  root.style.setProperty('--sidebar-ring', `${hue} 76% 46%`);
  root.style.setProperty('--nutrient-protein', `${hue} 76% 46%`);
  root.style.setProperty('--nutrient-fiber', `${hue} 60% 40%`);
  root.style.setProperty('--shadow-glow', `0 0 30px hsl(${hue} 76% 46% / 0.2)`);
}

function applyDesignStyle(style: DesignStyle) {
  document.documentElement.classList.toggle('liquid-glass', style === 'liquid-glass');
}

export function useAppearance() {
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_APPEARANCE, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_APPEARANCE;
  });

  // Apply on mount and changes
  useEffect(() => {
    applyTheme(appearance.themeMode);
    applyAccentHue(appearance.accentHue);
    applyDesignStyle(appearance.designStyle);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  }, [appearance]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (appearance.themeMode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [appearance.themeMode]);

  const updateAppearance = useCallback((updates: Partial<AppearanceSettings>) => {
    setAppearance(prev => ({ ...prev, ...updates }));
  }, []);

  return { appearance, updateAppearance };
}
