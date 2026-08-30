/**
 * CMS persistence (IndexedDB) — site settings, pages, SEO, media, waters overrides, news drafts.
 */

const DB_NAME = 'rybalka_cms_db';
const DB_VERSION = 1;
const SEEDED_KEY = 'rybalka_cms_seeded_v1';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('waters')) {
        const s = db.createObjectStore('waters', { keyPath: 'id' });
        s.createIndex('type', 'type', { unique: false });
        s.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('news')) {
        const s = db.createObjectStore('news', { keyPath: 'id' });
        s.createIndex('status', 'status', { unique: false });
        s.createIndex('published_at', 'published_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('media')) {
        const s = db.createObjectStore('media', { keyPath: 'id' });
        s.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('audit')) {
        const s = db.createObjectStore('audit', { keyPath: 'id' });
        s.createIndex('created_at', 'created_at', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(name, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(name, mode);
  const store = tx.objectStore(name);
  const result = await fn(store);
  await txDone(tx);
  db.close();
  return result;
}

export const cmsDb = {
  async getKv(key) {
    const row = await withStore('kv', 'readonly', (s) => reqToPromise(s.get(key)));
    return row?.value ?? null;
  },

  async setKv(key, value) {
    await withStore('kv', 'readwrite', (s) => s.put({ key, value }));
    return value;
  },

  async listWaters() {
    return withStore('waters', 'readonly', (s) => reqToPromise(s.getAll()));
  },

  async getWater(id) {
    return withStore('waters', 'readonly', (s) => reqToPromise(s.get(String(id))));
  },

  async putWater(record) {
    const row = { ...record, id: String(record.id), updated_at: new Date().toISOString() };
    await withStore('waters', 'readwrite', (s) => s.put(row));
    return row;
  },

  async deleteWater(id) {
    await withStore('waters', 'readwrite', (s) => s.delete(String(id)));
  },

  async listNews(status) {
    const all = await withStore('news', 'readonly', (s) => reqToPromise(s.getAll()));
    if (!status || status === 'all') return all;
    return all.filter((n) => n.status === status);
  },

  async getNews(id) {
    return withStore('news', 'readonly', (s) => reqToPromise(s.get(id)));
  },

  async putNews(record) {
    const row = { ...record, updated_at: new Date().toISOString() };
    await withStore('news', 'readwrite', (s) => s.put(row));
    return row;
  },

  async deleteNews(id) {
    await withStore('news', 'readwrite', (s) => s.delete(id));
  },

  async listMedia() {
    const rows = await withStore('media', 'readonly', (s) => reqToPromise(s.getAll()));
    return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async putMedia(record) {
    await withStore('media', 'readwrite', (s) => s.put(record));
    return record;
  },

  async deleteMedia(id) {
    await withStore('media', 'readwrite', (s) => s.delete(id));
  },

  async addAudit(entry) {
    const row = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...entry,
    };
    await withStore('audit', 'readwrite', (s) => s.add(row));
    return row;
  },

  async listAudit(limit = 100) {
    const all = await withStore('audit', 'readonly', (s) => reqToPromise(s.getAll()));
    return all
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit);
  },

  isSeeded() {
    return localStorage.getItem(SEEDED_KEY) === '1';
  },

  markSeeded() {
    localStorage.setItem(SEEDED_KEY, '1');
  },
};
