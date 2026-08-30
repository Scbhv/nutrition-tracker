/**
 * Settings search helpers: synonyms, fuzzy matching, typeahead suggestions
 * and persistence of the last query.
 */

const QUERY_KEY = 'nutrient-tracker-settings-search';

export function loadSettingsQuery(): string {
  try {
    return localStorage.getItem(QUERY_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveSettingsQuery(query: string): void {
  try {
    if (query) localStorage.setItem(QUERY_KEY, query);
    else localStorage.removeItem(QUERY_KEY);
  } catch {
    /* storage unavailable – ignore */
  }
}

/** Groups of interchangeable words. Any word matches every other in its group. */
const SYNONYM_GROUPS: string[][] = [
  ['backup', 'restore', 'save', 'archive', 'snapshot'],
  ['export', 'download', 'share', 'save file'],
  ['import', 'upload', 'load', 'merge'],
  ['appearance', 'theme', 'look', 'style', 'design', 'skin', 'texture'],
  ['color', 'colour', 'accent', 'hue', 'palette'],
  ['dark mode', 'night mode', 'dark'],
  ['goals', 'targets', 'limits', 'macros'],
  ['nutrition', 'nutrients', 'vitamins', 'minerals'],
  ['sign out', 'log out', 'logout', 'signout', 'leave'],
  ['account', 'profile', 'user', 'login'],
  ['premium', 'pro', 'paid', 'subscription', 'unlock', 'donation'],
  ['feedback', 'contact', 'support', 'help', 'bug', 'issue', 'report'],
  ['offline', 'no internet', 'airplane', 'local'],
  ['error', 'log', 'crash', 'debug', 'diagnostics'],
  ['apple health', 'healthkit', 'health', 'shortcuts'],
  ['delete', 'remove', 'erase', 'wipe'],
  ['sync', 'cloud', 'icloud', 'server'],
  ['test', 'checklist', 'qa', 'verify'],
  ['food', 'library', 'database', 'foods'],
  ['recipe', 'recipes', 'meal', 'mealplan'],
];

/** Expand a query with its synonyms. */
export function expandQuery(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = new Set<string>([q]);
  for (const group of SYNONYM_GROUPS) {
    if (group.some((w) => w.includes(q) || q.includes(w))) {
      group.forEach((w) => out.add(w));
    }
  }
  return [...out];
}

/** Lightweight subsequence fuzzy match ("bckp" -> "backup"). */
export function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (!n) return true;
  if (h.includes(n)) return true;
  if (n.length < 3) return false;
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i += 1;
    if (i === n.length) return true;
  }
  return false;
}

/** Does any keyword match the query (direct, synonym, or fuzzy)? */
export function matchesKeywords(query: string, keywords: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const variants = expandQuery(q);
  return keywords.some((k) => variants.some((v) => fuzzyMatch(v, k) || k.toLowerCase().includes(v)));
}

export interface SettingsSuggestion {
  /** Visible label of the setting. */
  label: string;
  /** Section it belongs to (shown as secondary text). */
  section: string;
  /** Query to apply when picked. */
  query: string;
  keywords: string[];
}

export const SETTINGS_INDEX: SettingsSuggestion[] = [
  { label: 'Sign out', section: 'Account', query: 'sign out', keywords: ['sign out', 'log out', 'account', 'logout'] },
  { label: 'Premium status', section: 'Account', query: 'premium', keywords: ['premium', 'unlock', 'pro', 'donation'] },
  { label: 'Delete account', section: 'Account', query: 'delete account', keywords: ['delete account', 'remove account', 'erase'] },
  { label: 'Daily goals', section: 'Goals & Nutrition', query: 'goals', keywords: ['goals', 'daily goals', 'targets', 'calories'] },
  { label: 'Nutrient library', section: 'Goals & Nutrition', query: 'nutrient library', keywords: ['nutrient library', 'json', 'import', 'export', 'foods'] },
  { label: 'Theme & appearance', section: 'Appearance', query: 'appearance', keywords: ['appearance', 'theme', 'dark mode', 'color', 'accent'] },
  { label: 'Theme packs', section: 'Appearance', query: 'texture pack', keywords: ['texture', 'pack', 'theme packs', 'gallery'] },
  { label: 'Apple Health export', section: 'Data & Sync', query: 'apple health', keywords: ['apple health', 'healthkit', 'shortcuts', 'export'] },
  { label: 'Backup & restore', section: 'Advanced', query: 'backup', keywords: ['backup', 'restore', 'archive', 'save'] },
  { label: 'Offline simulation', section: 'Advanced', query: 'offline', keywords: ['offline', 'simulation', 'local'] },
  { label: 'Error log', section: 'Advanced', query: 'error log', keywords: ['error', 'log', 'debug', 'crash'] },
  { label: 'Test checklist', section: 'Advanced', query: 'test checklist', keywords: ['test', 'checklist', 'qa', 'diagnostics'] },
  { label: 'Send feedback', section: 'Support', query: 'feedback', keywords: ['feedback', 'bug', 'feature', 'contact', 'support'] },
];

/** Rank suggestions for the current query. Empty query -> no suggestions. */
export function getSuggestions(query: string, limit = 5): SettingsSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = SETTINGS_INDEX.map((item) => {
    const label = item.label.toLowerCase();
    let score = 0;
    if (label.startsWith(q)) score = 100;
    else if (label.includes(q)) score = 80;
    else if (item.keywords.some((k) => k.toLowerCase().includes(q))) score = 60;
    else if (matchesKeywords(q, [item.label, ...item.keywords])) score = 30;
    return { item, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
