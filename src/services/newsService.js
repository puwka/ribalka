import { api, apiDataEnabled, resolveMediaUrl } from '../lib/apiClient';
import { mapNewsToUi } from '../lib/mappers';
import { newsAdminService } from './newsAdminService';
import { cmsDb } from '../lib/cmsDb';

function toUi(row) {
  if (!row) return null;
  return mapNewsToUi({
    ...row,
    cover_url:
      row.cover_url ||
      row.image ||
      resolveMediaUrl(null, 'news-images', row.cover_path, null),
    author_name: row.author_name || row.author,
  });
}

export const newsService = {
  isEnabled: () => apiDataEnabled,

  async list() {
    if (this.isEnabled()) {
      const rows = await api.get('/api/news');
      return (rows ?? []).map(toUi);
    }
    return newsAdminService.listPublic();
  },

  async getById(id) {
    if (this.isEnabled()) {
      const row = await api.get(`/api/news/${encodeURIComponent(id)}`);
      return toUi(row);
    }
    return newsAdminService.getById(id);
  },

  /** Increment views in DB (or local store) and return updated article */
  async recordView(id) {
    if (!id) return null;
    if (this.isEnabled()) {
      const row = await api.post(`/api/news/${encodeURIComponent(id)}/view`, {});
      return toUi(row);
    }
    const local = await cmsDb.getNews(String(id));
    if (!local) return null;
    const current = Number(local.views_count) || Number(local.views) || 0;
    const next = {
      ...local,
      views_count: current + 1,
      views: current + 1,
      updated_at: new Date().toISOString(),
    };
    await cmsDb.putNews(next);
    return toUi(next);
  },
};
