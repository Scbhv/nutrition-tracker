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

/** Read a JSON file from the NutriTrack folder. Returns null if missing. */
export async function readJSONFile<T>(filename: string): Promise<T | null> {
  if (!isNative()) {
    const raw = localStorage.getItem(`nutrient-tracker-${filename.replace('.json', '')}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  try {
    const result = await Filesystem.readFile({
      path: `${FOLDER}/${filename}`,
      directory: DIR,
      encoding: Encoding.UTF8,
    });
    const data = typeof result.data === 'string' ? result.data : await (result.data as Blob).text();
    return JSON.parse(data) as T;
  } catch (err) {
    // File does not exist yet
    return null;
  }
}

/** Write a JSON file into the NutriTrack folder (creates folder if needed). */
export async function writeJSONFile(filename: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);

  if (!isNative()) {
    localStorage.setItem(`nutrient-tracker-${filename.replace('.json', '')}`, json);
    return;
  }

  await ensureFolder();
  await Filesystem.writeFile({
    path: `${FOLDER}/${filename}`,
    data: json,
    directory: DIR,
    encoding: Encoding.UTF8,
  });
}

export const STORAGE_FILES = {
  foods: 'foods.json',
  logs: 'logs.json',
  settings: 'settings.json',
} as const;
