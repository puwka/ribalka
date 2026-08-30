/**
 * Social layer: fishing reports + forum (IndexedDB).
 * Migrates legacy localStorage `fishing_reports` once.
 */

const DB_NAME = 'rybalka_social_db';
const DB_VERSION = 1;
const LEGACY_KEY = 'fishing_reports';
const MIGRATED_FLAG = 'rybalka_social_reports_migrated_v1';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('reports')) {
        const s = db.createObjectStore('reports', { keyPath: 'id' });
        s.createIndex('status', 'status', { unique: false });
        s.createIndex('authorUserId', 'authorUserId', { unique: false });
        s.createIndex('baseId', 'baseId', { unique: false });
        s.createIndex('date', 'date', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('forum_topics')) {
        const t = db.createObjectStore('forum_topics', { keyPath: 'id' });
        t.createIndex('status', 'status', { unique: false });
        t.createIndex('authorId', 'authorId', { unique: false });
        t.createIndex('baseId', 'baseId', { unique: false });
        t.createIndex('lastMessageAt', 'lastMessageAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('forum_messages')) {
        const m = db.createObjectStore('forum_messages', { keyPath: 'id' });
        m.createIndex('topicId', 'topicId', { unique: false });
        m.createIndex('authorId', 'authorId', { unique: false });
        m.createIndex('parentId', 'parentId', { unique: false });
        m.createIndex('status', 'status', { unique: false });
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

function normalizeLegacyReport(r) {
  return {
    id: String(r.id),
    author: r.author || 'Рыболов',
    authorUserId: r.authorUserId || null,
    place: r.place || '',
    baseId: r.baseId || null,
    baseName: r.baseName || null,
    date: r.date || (r.createdAt || '').slice(0, 10),
    fish: r.fish || '',
    bait: r.bait || '',
    weight: r.weight || '',
    description: r.description || '',
    extra: r.extra || '',
    images: Array.isArray(r.images) ? r.images : [],
    videos: Array.isArray(r.videos) ? r.videos : [],
    rating: typeof r.rating === 'number' ? r.rating : 0,
    likedBy: Array.isArray(r.votedBy) ? r.votedBy.map(String) : Array.isArray(r.likedBy) ? r.likedBy.map(String) : [],
    starSum: typeof r.starSum === 'number' ? r.starSum : 0,
    starCount: typeof r.starCount === 'number' ? r.starCount : 0,
    starBy: r.starBy && typeof r.starBy === 'object' ? r.starBy : {},
    comments: Array.isArray(r.comments)
      ? r.comments.map((c) => ({
          id: String(c.id),
          author: c.author,
          authorUserId: c.authorUserId || null,
          text: c.text,
          date: c.date || c.createdAt || new Date().toISOString(),
          parentId: c.parentId != null ? String(c.parentId) : null,
          status: c.status || 'approved',
        }))
      : [],
    status: r.status || 'approved',
    moderationNote: r.moderationNote || null,
    moderatedAt: r.moderatedAt || null,
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || r.createdAt || new Date().toISOString(),
  };
}

let migratePromise = null;

async function ensureReportsMigrated() {
  if (localStorage.getItem(MIGRATED_FLAG) === '1') return;
  if (migratePromise) return migratePromise;
  migratePromise = (async () => {
    const existing = await withStore('reports', 'readonly', (store) => reqToPromise(store.count()));
    if (existing > 0) {
      localStorage.setItem(MIGRATED_FLAG, '1');
      return;
    }
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATED_FLAG, '1');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      await withStore('reports', 'readwrite', async (store) => {
        for (const row of parsed) {
          store.put(normalizeLegacyReport(row));
        }
        return Promise.resolve();
      });
    } catch {
      // ignore corrupt legacy
    }
    localStorage.setItem(MIGRATED_FLAG, '1');
  })();
  return migratePromise;
}

export const CONTENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  HIDDEN: 'hidden',
};

export const socialDb = {
  async listReports() {
    await ensureReportsMigrated();
    return withStore('reports', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async getReport(id) {
    await ensureReportsMigrated();
    return withStore('reports', 'readonly', (store) => reqToPromise(store.get(String(id))));
  },

  async putReport(report) {
    await ensureReportsMigrated();
    const row = { ...report, id: String(report.id), updatedAt: new Date().toISOString() };
    await withStore('reports', 'readwrite', (store) => {
      store.put(row);
      return Promise.resolve();
    });
    return row;
  },

  async deleteReport(id) {
    await withStore('reports', 'readwrite', (store) => {
      store.delete(String(id));
      return Promise.resolve();
    });
  },

  async listTopics() {
    return withStore('forum_topics', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async getTopic(id) {
    return withStore('forum_topics', 'readonly', (store) => reqToPromise(store.get(String(id))));
  },

  async putTopic(topic) {
    const row = { ...topic, id: String(topic.id), updatedAt: new Date().toISOString() };
    await withStore('forum_topics', 'readwrite', (store) => {
      store.put(row);
      return Promise.resolve();
    });
    return row;
  },

  async deleteTopic(id) {
    await withStore('forum_topics', 'readwrite', (store) => {
      store.delete(String(id));
      return Promise.resolve();
    });
    const msgs = await this.listMessagesByTopic(id);
    await withStore('forum_messages', 'readwrite', async (store) => {
      for (const m of msgs) store.delete(m.id);
      return Promise.resolve();
    });
  },

  async listMessagesByTopic(topicId) {
    return withStore('forum_messages', 'readonly', async (store) => {
      const idx = store.index('topicId');
      return reqToPromise(idx.getAll(String(topicId)));
    });
  },

  async listAllMessages() {
    return withStore('forum_messages', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async getMessage(id) {
    return withStore('forum_messages', 'readonly', (store) => reqToPromise(store.get(String(id))));
  },

  async putMessage(message) {
    const row = { ...message, id: String(message.id), updatedAt: new Date().toISOString() };
    await withStore('forum_messages', 'readwrite', (store) => {
      store.put(row);
      return Promise.resolve();
    });
    return row;
  },

  async deleteMessage(id) {
    await withStore('forum_messages', 'readwrite', (store) => {
      store.delete(String(id));
      return Promise.resolve();
    });
  },
};
