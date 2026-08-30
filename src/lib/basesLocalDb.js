/**
 * IndexedDB persistence for fishing bases (no demo/seed data).
 * Used when Supabase data mode is off, or as offline-capable local DB.
 */

const DB_NAME = 'rybalka_bases_db';
const DB_VERSION = 1;
const STORE = 'bases';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('owner_id', 'owner_id', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
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
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const store = tx.objectStore(STORE);
  const result = await fn(store);
  await txDone(tx);
  db.close();
  return result;
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const basesLocalDb = {
  async getAll() {
    return withStore('readonly', (store) => reqToPromise(store.getAll()));
  },

  async getById(id) {
    return withStore('readonly', (store) => reqToPromise(store.get(id)));
  },

  async put(record) {
    await withStore('readwrite', (store) => {
      store.put(record);
      return Promise.resolve();
    });
    return record;
  },

  async delete(id) {
    await withStore('readwrite', (store) => {
      store.delete(id);
      return Promise.resolve();
    });
  },

  async listByOwner(ownerId) {
    const all = await this.getAll();
    return all.filter((b) => b.owner_id === ownerId);
  },

  async listByStatus(statuses) {
    const all = await this.getAll();
    const set = new Set(statuses);
    return all.filter((b) => set.has(b.status));
  },

  async listApproved(type) {
    const all = await this.getAll();
    return all.filter(
      (b) => b.status === 'approved' && (!type || b.type === type)
    );
  },
};
