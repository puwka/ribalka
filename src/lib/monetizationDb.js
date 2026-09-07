/**
 * Monetization persistence (IndexedDB): plans, subscriptions, payments, ad orders.
 */

const DB_NAME = 'rybalka_monetization_db';
const DB_VERSION = 1;
const SEEDED_KEY = 'rybalka_monetization_seeded_v2';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('plans')) {
        const s = db.createObjectStore('plans', { keyPath: 'id' });
        s.createIndex('code', 'code', { unique: true });
        s.createIndex('is_active', 'is_active', { unique: false });
      }
      if (!db.objectStoreNames.contains('subscriptions')) {
        const s = db.createObjectStore('subscriptions', { keyPath: 'id' });
        s.createIndex('user_id', 'user_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('payments')) {
        const s = db.createObjectStore('payments', { keyPath: 'id' });
        s.createIndex('user_id', 'user_id', { unique: false });
        s.createIndex('status', 'status', { unique: false });
        s.createIndex('provider', 'provider', { unique: false });
      }
      if (!db.objectStoreNames.contains('ad_orders')) {
        const s = db.createObjectStore('ad_orders', { keyPath: 'id' });
        s.createIndex('owner_id', 'owner_id', { unique: false });
        s.createIndex('status', 'status', { unique: false });
        s.createIndex('ad_type', 'ad_type', { unique: false });
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

export const DEFAULT_PLANS = [
  {
    id: 'plan_owner_constructor',
    code: 'owner_constructor',
    name: 'Конструктор',
    description:
      'Размещение платной базы: 1 фото и 1 видео в базе тарифа, опции ТОП / рамка / доп. медиа',
    price_month: 2900,
    price_year: 24360,
    currency: 'RUB',
    period_days_month: 30,
    period_days_year: 365,
    discount_year_percent: 30,
    features: [
      'Размещение базы на сайте',
      '1 фото и 1 видео в базе',
      'Опции: ТОП, жёлтая рамка, доп. медиа',
      'Скидки при оплате за 3 / 6 / 12 мес.',
    ],
    limits: { bases: 5, ads_active: 0, featured: false, search_boost: false, mailing: false },
    target_role: 'owner',
    is_active: true,
    sort_order: 10,
  },
];

async function ensureSeeded() {
  if (localStorage.getItem(SEEDED_KEY) === '1') return;
  const now = new Date().toISOString();
  await withStore('plans', 'readwrite', async (store) => {
    const existing = await reqToPromise(store.getAll());
    for (const old of existing) {
      if (old.target_role === 'owner' || String(old.code || '').startsWith('owner_')) {
        store.delete(old.id);
      }
    }
    for (const p of DEFAULT_PLANS) {
      store.put({ ...p, created_at: now, updated_at: now });
    }
    return Promise.resolve();
  });
  localStorage.setItem(SEEDED_KEY, '1');
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
};

export const AD_TYPES = {
  BANNER: 'banner',
  SEARCH_PROMO: 'search_promo',
  FEATURED: 'featured',
  MAILING: 'mailing',
  PROMO_CAMPAIGN: 'promo_campaign',
};

export const AD_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  PAUSED: 'paused',
  DISABLED: 'disabled',
  EXPIRED: 'expired',
};

export const monetizationDb = {
  async listPlans() {
    await ensureSeeded();
    return withStore('plans', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async getPlan(id) {
    await ensureSeeded();
    return withStore('plans', 'readonly', (store) => reqToPromise(store.get(id)));
  },

  async getPlanByCode(code) {
    await ensureSeeded();
    return withStore('plans', 'readonly', async (store) => {
      const idx = store.index('code');
      return reqToPromise(idx.get(code));
    });
  },

  async putPlan(plan) {
    await ensureSeeded();
    const row = { ...plan, updated_at: new Date().toISOString() };
    await withStore('plans', 'readwrite', (store) => {
      store.put(row);
      return Promise.resolve();
    });
    return row;
  },

  async deletePlan(id) {
    await withStore('plans', 'readwrite', (store) => {
      store.delete(id);
      return Promise.resolve();
    });
  },

  async listSubscriptions() {
    return withStore('subscriptions', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async listSubscriptionsByUser(userId) {
    return withStore('subscriptions', 'readonly', async (store) => {
      const idx = store.index('user_id');
      return reqToPromise(idx.getAll(userId));
    });
  },

  async getSubscription(id) {
    return withStore('subscriptions', 'readonly', (store) => reqToPromise(store.get(id)));
  },

  async putSubscription(row) {
    const next = { ...row, updated_at: new Date().toISOString() };
    await withStore('subscriptions', 'readwrite', (store) => {
      store.put(next);
      return Promise.resolve();
    });
    return next;
  },

  async listPayments() {
    return withStore('payments', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async listPaymentsByUser(userId) {
    return withStore('payments', 'readonly', async (store) => {
      const idx = store.index('user_id');
      return reqToPromise(idx.getAll(userId));
    });
  },

  async getPayment(id) {
    return withStore('payments', 'readonly', (store) => reqToPromise(store.get(id)));
  },

  async putPayment(row) {
    const next = { ...row, updated_at: new Date().toISOString() };
    await withStore('payments', 'readwrite', (store) => {
      store.put(next);
      return Promise.resolve();
    });
    return next;
  },

  async listAdOrders() {
    return withStore('ad_orders', 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async listAdOrdersByOwner(ownerId) {
    return withStore('ad_orders', 'readonly', async (store) => {
      const idx = store.index('owner_id');
      return reqToPromise(idx.getAll(ownerId));
    });
  },

  async getAdOrder(id) {
    return withStore('ad_orders', 'readonly', (store) => reqToPromise(store.get(id)));
  },

  async putAdOrder(row) {
    const next = { ...row, updated_at: new Date().toISOString() };
    await withStore('ad_orders', 'readwrite', (store) => {
      store.put(next);
      return Promise.resolve();
    });
    return next;
  },
};
