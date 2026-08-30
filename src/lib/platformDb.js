/**
 * Platform analytics + reviews (IndexedDB).
 * Events are written from public UI; OWNER dashboard aggregates them.
 */

const DB_NAME = 'rybalka_platform_db';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('events')) {
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('owner_id', 'owner_id', { unique: false });
        events.createIndex('base_id', 'base_id', { unique: false });
        events.createIndex('type', 'type', { unique: false });
        events.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('reviews')) {
        const reviews = db.createObjectStore('reviews', { keyPath: 'id' });
        reviews.createIndex('owner_id', 'owner_id', { unique: false });
        reviews.createIndex('base_id', 'base_id', { unique: false });
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

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await fn(store, tx);
  await txDone(tx);
  db.close();
  return result;
}

export function getAnalyticsSessionId() {
  const key = 'rybalka_analytics_session';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export const platformDb = {
  async addEvent(event) {
    const row = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      session_id: getAnalyticsSessionId(),
      ...event,
    };
    await withStore('events', 'readwrite', (store) => {
      store.add(row);
      return Promise.resolve(row);
    });
    return row;
  },

  async listEventsByOwner(ownerId) {
    return withStore('events', 'readonly', async (store) => {
      const idx = store.index('owner_id');
      return reqToPromise(idx.getAll(ownerId));
    });
  },

  async listEventsByBase(baseId) {
    return withStore('events', 'readonly', async (store) => {
      const idx = store.index('base_id');
      return reqToPromise(idx.getAll(String(baseId)));
    });
  },

  async addReview(review) {
    const row = {
      id: crypto.randomUUID(),
      status: 'approved',
      owner_reply: null,
      owner_replied_at: null,
      created_at: new Date().toISOString(),
      ...review,
    };
    await withStore('reviews', 'readwrite', (store) => {
      store.add(row);
      return Promise.resolve(row);
    });
    return row;
  },

  async listReviewsByOwner(ownerId) {
    return withStore('reviews', 'readonly', async (store) => {
      const idx = store.index('owner_id');
      return reqToPromise(idx.getAll(ownerId));
    });
  },

  async listReviewsByBase(baseId) {
    return withStore('reviews', 'readonly', async (store) => {
      const idx = store.index('base_id');
      return reqToPromise(idx.getAll(String(baseId)));
    });
  },

  async getReview(id) {
    return withStore('reviews', 'readonly', (store) => reqToPromise(store.get(id)));
  },

  async updateReview(id, patch) {
    return withStore('reviews', 'readwrite', async (store) => {
      const existing = await reqToPromise(store.get(id));
      if (!existing) throw new Error('Отзыв не найден');
      const next = { ...existing, ...patch };
      store.put(next);
      return next;
    });
  },

  async listAllReviews() {
    return withStore('reviews', 'readonly', (store) => reqToPromise(store.getAll()));
  },
};
