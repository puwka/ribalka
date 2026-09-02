import { api, apiDataEnabled } from '../lib/apiClient';
import { resolveMediaUrl } from '../lib/apiClient';
import { mapNewsToUi } from '../lib/mappers';

export const newsService = {
  isEnabled: () => apiDataEnabled,

  async list() {
    if (!this.isEnabled()) return null;

    const rows = await api.get('/api/news');

    return (rows ?? []).map((row) =>
      mapNewsToUi({
        ...row,
        cover_url:
          row.cover_url ||
          resolveMediaUrl(null, 'news-images', row.cover_path, null),
      })
    );
  },

  async getById(id) {
    if (!this.isEnabled()) return null;

    const row = await api.get(`/api/news/${id}`);
    if (!row) return null;

    return mapNewsToUi({
      ...row,
      cover_url:
        row.cover_url ||
        resolveMediaUrl(null, 'news-images', row.cover_path, null),
    });
  },
};
