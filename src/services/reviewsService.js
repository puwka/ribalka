import { api, apiDataEnabled } from '../lib/apiClient';
import { platformDb } from '../lib/platformDb';

export const reviewsService = {
  async listByTarget(targetId) {
    if (apiDataEnabled) {
      return api.get(`/api/reviews?targetId=${encodeURIComponent(targetId)}`);
    }
    const rows = await platformDb.listReviewsByBase(targetId);
    return rows.filter((r) => r.status === 'approved' || !r.status);
  },

  async listForModeration(status = 'all') {
    if (apiDataEnabled) {
      return api.get(`/api/reviews/moderation?status=${encodeURIComponent(status)}`);
    }
    const rows = await platformDb.listAllReviews();
    if (status === 'all') return rows;
    return rows.filter((r) => r.status === status);
  },

  async create({ targetId, targetName, authorName, body, rating, userId = null }) {
    if (apiDataEnabled) {
      return api.post('/api/reviews', {
        target_id: targetId,
        target_name: targetName,
        author_name: authorName,
        body,
        rating,
      });
    }
    return platformDb.addReview({
      base_id: String(targetId),
      target_id: String(targetId),
      target_name: targetName,
      owner_id: null,
      user_id: userId,
      author_name: authorName,
      body,
      rating,
      status: 'pending',
    });
  },

  async moderate(id, status) {
    if (apiDataEnabled) {
      return api.patch(`/api/reviews/${encodeURIComponent(id)}`, { status });
    }
    return platformDb.updateReview(id, { status });
  },
};
