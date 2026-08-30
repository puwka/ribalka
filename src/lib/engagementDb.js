/**
 * User engagement: favorites, activity stats, achievements (IndexedDB).
 * Auto-unlock gamification is driven by counters, not static flags.
 */

const DB_NAME = 'rybalka_engagement_db';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('favorites')) {
        const fav = db.createObjectStore('favorites', { keyPath: 'id' });
        fav.createIndex('user_id', 'user_id', { unique: false });
        fav.createIndex('user_type', ['user_id', 'type'], { unique: false });
        fav.createIndex('user_target', ['user_id', 'type', 'target_id'], { unique: true });
      }
      if (!db.objectStoreNames.contains('stats')) {
        db.createObjectStore('stats', { keyPath: 'user_id' });
      }
      if (!db.objectStoreNames.contains('achievements')) {
        const ach = db.createObjectStore('achievements', { keyPath: 'id' });
        ach.createIndex('user_id', 'user_id', { unique: false });
        ach.createIndex('user_code', ['user_id', 'code'], { unique: true });
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
  const result = await fn(store);
  await txDone(tx);
  db.close();
  return result;
}

const emptyStats = (userId) => ({
  user_id: userId,
  reports_count: 0,
  comments_count: 0,
  likes_received: 0,
  likes_given: 0,
  places_visited: [],
  favorites_added: 0,
  updated_at: new Date().toISOString(),
});

export const engagementDb = {
  async listFavorites(userId, type) {
    return withStore('favorites', 'readonly', async (store) => {
      if (type) {
        const idx = store.index('user_type');
        return reqToPromise(idx.getAll([userId, type]));
      }
      const idx = store.index('user_id');
      return reqToPromise(idx.getAll(userId));
    });
  },

  async findFavorite(userId, type, targetId) {
    return withStore('favorites', 'readonly', async (store) => {
      const idx = store.index('user_target');
      return reqToPromise(idx.get([userId, type, String(targetId)]));
    });
  },

  async listByTarget(targetId) {
    return withStore('favorites', 'readonly', async (store) => {
      const all = await reqToPromise(store.getAll());
      return all.filter((f) => String(f.target_id) === String(targetId));
    });
  },

  async addFavorite(row) {
    const existing = await this.findFavorite(row.user_id, row.type, row.target_id);
    if (existing) return existing;
    const next = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...row,
      target_id: String(row.target_id),
    };
    await withStore('favorites', 'readwrite', (store) => {
      store.add(next);
      return Promise.resolve();
    });
    return next;
  },

  async removeFavorite(userId, type, targetId) {
    const existing = await this.findFavorite(userId, type, targetId);
    if (!existing) return false;
    await withStore('favorites', 'readwrite', (store) => {
      store.delete(existing.id);
      return Promise.resolve();
    });
    return true;
  },

  async getStats(userId) {
    const row = await withStore('stats', 'readonly', (store) =>
      reqToPromise(store.get(userId))
    );
    return row || emptyStats(userId);
  },

  async saveStats(stats) {
    const next = { ...stats, updated_at: new Date().toISOString() };
    await withStore('stats', 'readwrite', (store) => {
      store.put(next);
      return Promise.resolve();
    });
    return next;
  },

  async listAchievements(userId) {
    return withStore('achievements', 'readonly', async (store) => {
      const idx = store.index('user_id');
      return reqToPromise(idx.getAll(userId));
    });
  },

  async hasAchievement(userId, code) {
    return withStore('achievements', 'readonly', async (store) => {
      const idx = store.index('user_code');
      const row = await reqToPromise(idx.get([userId, code]));
      return Boolean(row);
    });
  },

  async unlockAchievement(userId, code) {
    if (await this.hasAchievement(userId, code)) return null;
    const row = {
      id: `${userId}:${code}`,
      user_id: userId,
      code,
      earned_at: new Date().toISOString(),
    };
    try {
      await withStore('achievements', 'readwrite', (store) => {
        store.add(row);
        return Promise.resolve();
      });
      return row;
    } catch {
      return null;
    }
  },

  async listAllAchievements() {
    return withStore('achievements', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async listAllStats() {
    return withStore('stats', 'readonly', (store) => reqToPromise(store.getAll()));
  },
};
