/**
 * Lightweight in-app error log.
 *
 * Records the last 100 errors in localStorage so users can copy
 * details for bug reports. Sources are free-form labels (e.g.
 * "Barcode Scan", "AI Lookup", "HealthKit Export", "Import Parser").
 *
 * Optionally hooks window.onerror + unhandledrejection to capture
 * crashes that aren't wrapped in try/catch.
 */

const STORAGE_KEY = 'nutrient-tracker-error-log';
const LIMIT = 100;

export interface ErrorEntry {
  id: string;
  timestamp: string;
  source: string;     // e.g. "Barcode Scan"
  message: string;    // human-readable summary
  detail?: string;    // stack trace, response body, etc.
}

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function getErrorLog(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

export function logError(source: string, error: unknown, extra?: string): void {
  const entry: ErrorEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source,
    message:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : safeStringify(error),
    detail:
      extra ??
      (error instanceof Error && error.stack ? error.stack : undefined),
  };
  try {
    const next = [entry, ...getErrorLog()].slice(0, LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  // Also keep noise in the dev console.
  // eslint-disable-next-line no-console
  console.error(`[${source}]`, error);
  emit();
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}

export function subscribeErrorLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatErrorReport(entries: ErrorEntry[] = getErrorLog()): string {
  if (entries.length === 0) return 'No errors recorded.';
  const lines: string[] = [
    `# NutriTrack error report`,
    `Generated: ${new Date().toISOString()}`,
    `User-Agent: ${navigator.userAgent}`,
    `Entries: ${entries.length}`,
    '',
  ];
  entries.forEach((e, i) => {
    lines.push(`## ${i + 1}. ${e.source} — ${new Date(e.timestamp).toLocaleString()}`);
    lines.push(e.message);
    if (e.detail) {
      lines.push('```');
      lines.push(e.detail);
      lines.push('```');
    }
    lines.push('');
  });
  return lines.join('\n');
}

let installed = false;
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    logError('Uncaught', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError('Unhandled Promise', event.reason);
  });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
