import { api, apiDataEnabled } from '../lib/apiClient';

export const directoryOwnerService = {
  async listMine() {
    if (!apiDataEnabled) return [];
    return api.get('/api/directory/mine');
  },

  async getAnalytics(days = 30) {
    if (!apiDataEnabled) {
      return { days, items: [], totals: { views: 0, phone: 0, website: 0 } };
    }
    return api.get(`/api/directory/mine/analytics?days=${encodeURIComponent(days)}`);
  },
};
