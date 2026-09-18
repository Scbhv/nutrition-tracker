import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

/**
 * NutriTrack persistent storage adapter.
 *
 * On native platforms (iOS/Android via Capacitor) data is automatically
 * stored as JSON files inside the app's Documents/NutriTrack/ folder.
 * On the web it transparently falls back to localStorage so the same
 * API works in the browser preview.
 */

const FOLDER = 'NutriTrack';
const DIR = Directory.Documents;

const isNative = () => Capacitor.isNativePlatform();

async function ensureFolder(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: FOLDER,
      directory: DIR,
      recursive: true,
    });
  } catch {
    // Already exists – ignore.
  }
}

const mirrorKey = (filename: string) => `nutrient-tracker-${filename.replace('.json', '')}`;

/** In-flight native writes, so callers can wait for disk before the app suspends. */
const pendingWrites = new Set<Promise<unknown>>();

/** Resolves once every queued write has hit disk. */
export async function flushStorage(): Promise<void> {
  while (pendingWrites.size > 0) {
    await Promise.allSettled([...pendingWrites]);
  }
}

function readMirror<T>(filename: string): T | null {
  try {
    const raw = localStorage.getItem(mirrorKey(filename));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Read a JSON file from the NutriTrack folder. Returns null if missing. */
export async function readJSONFile<T>(filename: string): Promise<T | null> {
  if (!isNative()) return readMirror<T>(filename);

  try {
    const result = await Filesystem.readFile({
      path: `${FOLDER}/${filename}`,
      directory: DIR,
      encoding: Encoding.UTF8,
    });
    const data = typeof result.data === 'string' ? result.data : await (result.data as Blob).text();
    return JSON.parse(data) as T;
  } catch {
    // File missing or unreadable — fall back to the synchronous mirror so a
    // reboot or an interrupted write never loses the last known good state.
    return readMirror<T>(filename);
  }
}

/** Write a JSON file into the NutriTrack folder (creates folder if needed). */
export async function writeJSONFile(filename: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);

  // Always mirror synchronously first: this survives an abrupt app kill.
  try {
    localStorage.setItem(mirrorKey(filename), json);
  } catch {
    // Quota or private mode — the file write below is still attempted.
  }

  if (!isNative()) return;

  const task = (async () => {
    await ensureFolder();
    await Filesystem.writeFile({
      path: `${FOLDER}/${filename}`,
      data: json,
      directory: DIR,
      encoding: Encoding.UTF8,
    });
  })();

  pendingWrites.add(task);
  try {
    await task;
  } finally {
    pendingWrites.delete(task);
  }
}

export const STORAGE_FILES = {
  foods: 'foods.json',
  logs: 'logs.json',
  settings: 'settings.json',
} as const;
