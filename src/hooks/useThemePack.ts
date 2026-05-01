import { useEffect, useState, useCallback } from 'react';

export interface AppliedThemePack {
  id: string;
  name: string;
  accentHue: number;
  backgroundUrl?: string;
  cardUrl?: string;
  buttonUrl?: string;
  accentUrl?: string;
}

const STORAGE_KEY = 'nutrient-tracker-active-theme-pack';

function applyToDom(pack: AppliedThemePack | null) {
  const root = document.documentElement;
  const setBg = (name: string, url?: string) => {
    if (url) {
      root.style.setProperty(name, `url("${url}")`);
    } else {
      root.style.removeProperty(name);
    }
  };
  setBg('--theme-pack-bg', pack?.backgroundUrl);
  setBg('--theme-pack-card', pack?.cardUrl);
  setBg('--theme-pack-button', pack?.buttonUrl);
  setBg('--theme-pack-accent', pack?.accentUrl);
  document.body.classList.toggle('has-theme-pack', !!pack);
  document.body.classList.toggle('has-theme-pack-card', !!pack?.cardUrl);
  document.body.classList.toggle('has-theme-pack-button', !!pack?.buttonUrl);
}

export function useThemePack() {
  const [active, setActive] = useState<AppliedThemePack | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AppliedThemePack) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    applyToDom(active);
    if (active) localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
    else localStorage.removeItem(STORAGE_KEY);
  }, [active]);

  const apply = useCallback((pack: AppliedThemePack) => setActive(pack), []);
  const clear = useCallback(() => setActive(null), []);

  return { active, apply, clear };
}
