/**
 * Settings history: a local audit trail of searches, restores, deletes and
 * settings edits — each with an optional undo payload.
 *
 * Everything lives in localStorage so the list survives reloads and works
 * completely offline.
 */

const KEY = 'nutrient-tracker-settings-history';
const MAX_ENTRIES = 60;

export type HistoryKind = 'search' | 'restore' | 'delete' | 'edit';

export interface HistoryEntry {
  id: string;
  at: string; // ISO timestamp
  kind: HistoryKind;
  title: string;
  detail?: string;
  /** Name of a registered undo handler. Absent = not undoable. */
  undoHandler?: string;
  /** Payload passed to the undo handler (must be JSON-serialisable). */
  undoPayload?: unknown;
  undone?: boolean;
}

type Listener = (entries: HistoryEntry[]) => void;

let cache: HistoryEntry[] | null = null;
const listeners = new Set<Listener>();
const handlers = new Map<string, (payload: unknown) => void | Promise<void>>();

function read(): HistoryEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(entries: HistoryEntry[]) {
  cache = entries.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full — drop the heaviest (snapshot-carrying) entries and retry once.
    cache = cache.filter((e) => !e.undoPayload).slice(0, 20);
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
      /* give up silently */
    }
  }
  listeners.forEach((l) => l(cache!));
}

export function getHistory(): HistoryEntry[] {
  return read();
}

export function subscribeHistory(listener: Listener): () => void {
  listeners.add(listener);
  listener(read());
  return () => listeners.delete(listener);
}

/** Register a function that can reverse a recorded action. */
export function registerUndoHandler(
  name: string,
  fn: (payload: unknown) => void | Promise<void>,
): () => void {
  handlers.set(name, fn);
  return () => {
    if (handlers.get(name) === fn) handlers.delete(name);
  };
}

export function recordHistory(entry: Omit<HistoryEntry, 'id' | 'at'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  write([full, ...read()]);
  return full;
}

/**
 * Searches are recorded lightly: repeating the same query in a row only
 * updates the timestamp instead of flooding the list.
 */
export function recordSearch(query: string, previousQuery: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const entries = read();
  const last = entries[0];
  if (last && last.kind === 'search' && last.title === trimmed) {
    write([{ ...last, at: new Date().toISOString() }, ...entries.slice(1)]);
    return;
  }
  recordHistory({
    kind: 'search',
    title: trimmed,
    detail: 'Settings search',
    undoHandler: 'search',
    undoPayload: { query: previousQuery },
  });
}

export function canUndo(entry: HistoryEntry): boolean {
  return !entry.undone && !!entry.undoHandler && handlers.has(entry.undoHandler);
}

export async function undoHistory(id: string): Promise<{ ok: boolean; error?: string }> {
  const entries = read();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return { ok: false, error: 'Entry not found.' };
  if (entry.undone) return { ok: false, error: 'Already undone.' };
  const fn = entry.undoHandler ? handlers.get(entry.undoHandler) : undefined;
  if (!fn) return { ok: false, error: 'This action can only be undone from the Settings page.' };
  try {
    await fn(entry.undoPayload);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Undo failed.' };
  }
  write(entries.map((e) => (e.id === id ? { ...e, undone: true } : e)));
  return { ok: true };
}

export function clearHistory() {
  write([]);
}

export function formatHistoryTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleString();
}
