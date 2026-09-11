import { api, apiDataEnabled } from '../lib/apiClient';

export const directoryOwnerService = {
  async enableOwner() {
    if (!apiDataEnabled) return { ok: true };
    return api.post('/api/directory/enable-owner', {});
  },

  async listMine() {
    if (!apiDataEnabled) return [];
    return api.get('/api/directory/mine');
  },

  async getById(id) {
    if (!apiDataEnabled) return null;
    return api.get(`/api/directory/mine/${encodeURIComponent(id)}`);
  },

  async createDraft(payload) {
    return api.post('/api/directory/mine', payload);
  },

  async update(id, payload) {
    return api.patch(`/api/directory/mine/${encodeURIComponent(id)}`, payload);
  },

  async getAnalytics(days = 30) {
    if (!apiDataEnabled) {
      return { days, items: [], totals: { views: 0, phone: 0, website: 0 } };
    }
    return api.get(`/api/directory/mine/analytics?days=${encodeURIComponent(days)}`);
  },
};
