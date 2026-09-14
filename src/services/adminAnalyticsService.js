import { api, apiDataEnabled } from '../lib/apiClient';

export const adminAnalyticsService = {
  async getOverview(days = 30) {
    if (!apiDataEnabled) {
      return {
        days,
        bases: { totals: {}, topItems: [], byOwner: [] },
        directory: { totals: {}, topItems: [], byOwner: [] },
      };
    }
    return api.get(`/api/analytics/admin?days=${encodeURIComponent(days)}`);
  },
};
