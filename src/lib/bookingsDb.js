/**
 * Bookings + base availability (IndexedDB). Real persistence, no mock list.
 */

const DB_NAME = 'rybalka_bookings_db';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('bookings')) {
        const store = db.createObjectStore('bookings', { keyPath: 'id' });
        store.createIndex('user_id', 'user_id', { unique: false });
        store.createIndex('owner_id', 'owner_id', { unique: false });
        store.createIndex('base_id', 'base_id', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('check_in', 'check_in', { unique: false });
      }
      if (!db.objectStoreNames.contains('availability')) {
        const av = db.createObjectStore('availability', { keyPath: 'id' });
        av.createIndex('base_id', 'base_id', { unique: false });
        av.createIndex('base_date', ['base_id', 'date'], { unique: true });
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

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const bookingsDb = {
  async add(booking) {
    await withStore('bookings', 'readwrite', (store) => {
      store.add(booking);
      return Promise.resolve();
    });
    return booking;
  },

  async put(booking) {
    await withStore('bookings', 'readwrite', (store) => {
      store.put(booking);
      return Promise.resolve();
    });
    return booking;
  },

  async get(id) {
    return withStore('bookings', 'readonly', (store) => reqToPromise(store.get(id)));
  },

  async listByUser(userId) {
    return withStore('bookings', 'readonly', async (store) => {
      const idx = store.index('user_id');
      return reqToPromise(idx.getAll(userId));
    });
  },

  async listByOwner(ownerId) {
    return withStore('bookings', 'readonly', async (store) => {
      const idx = store.index('owner_id');
      return reqToPromise(idx.getAll(ownerId));
    });
  },

  async listByBase(baseId) {
    return withStore('bookings', 'readonly', async (store) => {
      const idx = store.index('base_id');
      return reqToPromise(idx.getAll(String(baseId)));
    });
  },

  async listAll() {
    return withStore('bookings', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async setAvailability(row) {
    const existing = await withStore('availability', 'readonly', async (store) => {
      const idx = store.index('base_date');
      return reqToPromise(idx.get([String(row.base_id), row.date]));
    });
    const next = {
      id: existing?.id || crypto.randomUUID(),
      ...existing,
      ...row,
      base_id: String(row.base_id),
      updated_at: new Date().toISOString(),
    };
    await withStore('availability', 'readwrite', (store) => {
      store.put(next);
      return Promise.resolve();
    });
    return next;
  },

  async getAvailability(baseId, date) {
    return withStore('availability', 'readonly', async (store) => {
      const idx = store.index('base_date');
      return reqToPromise(idx.get([String(baseId), date]));
    });
  },

  async listAvailability(baseId) {
    return withStore('availability', 'readonly', async (store) => {
      const idx = store.index('base_id');
      return reqToPromise(idx.getAll(String(baseId)));
    });
  },
};
