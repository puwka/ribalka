/**
 * Snapshot of public catalog for offline / slow-network reads.
 * Filled when the user browses online; used when the API is unreachable.
 */

const BASES_KEY = 'rybalka:offline:bases-v1';
const NEWS_KEY = 'rybalka:offline:news-v1';
const REPORTS_KEY = 'rybalka:offline:reports-v1';

function write(key, list) {
  try {
    const slim = Array.isArray(list) ? list : [];
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), list: slim }));
  } catch {
    /* quota / private mode */
  }
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.list) ? parsed.list : null;
  } catch {
    return null;
  }
}

export function saveOfflineBases(list) {
  write(BASES_KEY, list);
}

export function loadOfflineBases() {
  return read(BASES_KEY);
}

export function saveOfflineNews(list) {
  write(NEWS_KEY, list);
}

export function loadOfflineNews() {
  return read(NEWS_KEY);
}

export function saveOfflineReports(list) {
  write(REPORTS_KEY, list);
}

export function loadOfflineReports() {
  return read(REPORTS_KEY);
}
