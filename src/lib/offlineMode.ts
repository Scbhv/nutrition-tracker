/**
 * Offline simulation mode.
 *
 * When enabled, app code should skip network calls (Open Food Facts,
 * AI lookup, Supabase functions for non-essential reads) and rely only
 * on the on-device JSON files in NutriTrack/.
 *
 * Also exposes a tiny event log so the UI can report which data source
 * served each request (e.g. "openfoodfacts", "ai", "local-db", "offline-skip").
 */

const STORAGE_KEY = 'nutrient-tracker-offline-mode';
const LOG_KEY = 'nutrient-tracker-source-log';
const LOG_LIMIT = 50;

export type DataSource =
  | 'local-db'
  | 'local-files'
  | 'openfoodfacts'
  | 'ai'
  | 'supabase'
  | 'offline-skip'
  | 'error';

export interface SourceEvent {
  id: string;
  timestamp: string;
  feature: string;        // e.g. 'AI Lookup', 'Barcode', 'Sign In'
  source: DataSource;
  detail?: string;
  ok: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function isOfflineMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOfflineMode(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSourceLog(): SourceEvent[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as SourceEvent[]) : [];
  } catch {
    return [];
  }
}

export function reportSource(
  feature: string,
  source: DataSource,
  opts: { ok?: boolean; detail?: string } = {}
): void {
  const event: SourceEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    feature,
    source,
    detail: opts.detail,
    ok: opts.ok ?? true,
  };
  try {
    const existing = getSourceLog();
    const next = [event, ...existing].slice(0, LOG_LIMIT);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  emit();
}

export function clearSourceLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    // ignore
  }
  emit();
}
