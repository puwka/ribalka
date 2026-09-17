import { api, apiDataEnabled } from '../lib/apiClient';

export const listingPaymentService = {
  isEnabled: () => apiDataEnabled,

  async getPrice() {
    if (!apiDataEnabled) {
      return {
        title: 'Тариф Конструктор',
        amount: 2900,
        currency: 'RUB',
        enabled: false,
      };
    }
    return api.get('/api/payments/listing-price');
  },

  /** Public read of base Constructor tariff (no auth) */
  async getPublicListingPrice() {
    if (!apiDataEnabled) {
      return {
        title: 'Тариф Конструктор',
        baseAmount: 2900,
        amount: 2900,
        addonTop: 1000,
        addonTopDaily: 300,
        addonFrame: 390,
        addonPhoto: 100,
        addonVideo: 100,
        discount3: 10,
        discount6: 20,
        discount12: 30,
        includedPhotos: 1,
        includedVideos: 1,
        enabled: true,
      };
    }
    return api.get('/api/payments/listing-price-public');
  },

  async getCheckoutPreview(baseId, options = {}) {
    const qs = new URLSearchParams({ baseId: String(baseId) });
    if (options.months) qs.set('months', String(options.months));
    if (options.top) qs.set('top', '1');
    if (options.frame) qs.set('frame', '1');
    if (options.extraPhotos) qs.set('extraPhotos', String(options.extraPhotos));
    if (options.extraVideos) qs.set('extraVideos', String(options.extraVideos));
    return api.get(`/api/payments/listing-checkout-preview?${qs}`);
  },

  async savePrice(payload) {
    return api.put('/api/payments/listing-price', payload);
  },

  async checkout(baseId, options = {}) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return api.post('/api/payments/listing-checkout', {
      baseId,
      returnUrl: `${origin}/owner/payment/result/:orderId`,
      months: options.months,
      top: options.top,
      frame: options.frame,
      extraPhotos: options.extraPhotos,
      extraVideos: options.extraVideos,
      mode: options.mode || undefined,
    });
  },

  async upgradeCheckout(baseId, options = {}) {
    return this.checkout(baseId, { ...options, mode: 'upgrade' });
  },

  async getUpgradePreview(baseId, options = {}) {
    const qs = new URLSearchParams({ baseId: String(baseId) });
    if (options.top) qs.set('top', '1');
    if (options.frame) qs.set('frame', '1');
    if (options.extraPhotos) qs.set('extraPhotos', String(options.extraPhotos));
    if (options.extraVideos) qs.set('extraVideos', String(options.extraVideos));
    return api.get(`/api/payments/listing-upgrade-preview?${qs}`);
  },

  async getTopSlots(baseId) {
    if (!apiDataEnabled) {
      return {
        max: 4,
        used: 0,
        free: 4,
        available: true,
        dailyAvailable: true,
        alreadyTop: false,
        addonTopDaily: 300,
      };
    }
    const qs = baseId ? `?baseId=${encodeURIComponent(baseId)}` : '';
    return api.get(`/api/payments/listing-top-slots${qs}`);
  },

  async checkoutTopDaily(baseId) {
    return this.checkout(baseId, { mode: 'top_daily' });
  },

  async getOrder(orderId) {
    return api.get(`/api/payments/listing-orders/${orderId}`);
  },

  async verify(orderId) {
    return api.post(`/api/payments/listing-orders/${orderId}/verify`, {});
  },

  async listMine(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.baseId) qs.set('baseId', filters.baseId);
    const q = qs.toString();
    return api.get(`/api/payments/listing-orders/mine${q ? `?${q}` : ''}`);
  },

  async listAdmin(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.baseId) qs.set('baseId', filters.baseId);
    if (filters.userId) qs.set('userId', filters.userId);
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    const q = qs.toString();
    return api.get(`/api/payments/listing-orders${q ? `?${q}` : ''}`);
  },

  async getDirectoryPrices() {
    return api.get('/api/payments/directory-prices');
  },

  async saveDirectoryPrice(kind, payload) {
    return api.put(`/api/payments/directory-prices/${encodeURIComponent(kind)}`, payload);
  },

  async directoryCheckout(payload) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return api.post('/api/payments/directory-checkout', {
      ...payload,
      returnUrl: `${origin}/owner/directory/payment/result/:orderId`,
    });
  },

  async directoryUpgradeCheckout(payload) {
    return this.directoryCheckout({ ...payload, mode: 'upgrade' });
  },

  async getDirectoryOrder(orderId) {
    return api.get(`/api/payments/directory-orders/${encodeURIComponent(orderId)}`);
  },

  async verifyDirectoryOrder(orderId) {
    return api.post(`/api/payments/directory-orders/${encodeURIComponent(orderId)}/verify`, {});
  },

  async listDirectoryOrdersAdmin(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    const q = qs.toString();
    return api.get(`/api/payments/directory-orders${q ? `?${q}` : ''}`);
  },
};
