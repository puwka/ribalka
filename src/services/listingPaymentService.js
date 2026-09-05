import { api, apiDataEnabled } from '../lib/apiClient';

export const listingPaymentService = {
  isEnabled: () => apiDataEnabled,

  async getPrice() {
    if (!apiDataEnabled) {
      return {
        title: 'Размещение рыболовной базы',
        amount: 0,
        currency: 'RUB',
        enabled: false,
      };
    }
    return api.get('/api/payments/listing-price');
  },

  async getCheckoutPreview(baseId) {
    return api.get(
      `/api/payments/listing-checkout-preview?baseId=${encodeURIComponent(baseId)}`
    );
  },

  async savePrice(payload) {
    return api.put('/api/payments/listing-price', payload);
  },

  async checkout(baseId) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return api.post('/api/payments/listing-checkout', {
      baseId,
      returnUrl: `${origin}/owner/payment/result/:orderId`,
    });
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
};
