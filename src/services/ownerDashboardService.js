import { platformDb, getAnalyticsSessionId } from '../lib/platformDb';
import { basesService } from './basesService';
import { localAuthStore } from '../lib/localAuthStore';
import { paymentService } from './paymentService';
import { plansService } from './plansService';

export const PERIODS = [
  { id: '7d', label: '7 дней', days: 7 },
  { id: '30d', label: '30 дней', days: 30 },
  { id: '90d', label: '3 месяца', days: 90 },
  { id: '365d', label: 'Год', days: 365 },
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(iso) {
  return startOfDay(iso).toISOString().slice(0, 10);
}

function inRange(iso, from) {
  return new Date(iso).getTime() >= from.getTime();
}

/**
 * Track public interactions against owner bases.
 */
export const analyticsTracker = {
  async trackView(base) {
    if (!base?.id || !base.ownerId && !base.owner_id) return;
    const ownerId = base.ownerId || base.owner_id;
    await platformDb.addEvent({
      type: 'view',
      base_id: String(base.id),
      owner_id: ownerId,
      source: 'base_modal',
    });
  },

  async trackClick(base, source = 'cta') {
    if (!base?.id || !(base.ownerId || base.owner_id)) return;
    await platformDb.addEvent({
      type: 'click',
      base_id: String(base.id),
      owner_id: base.ownerId || base.owner_id,
      source,
    });
  },

  async trackFavorite(base, userId, added) {
    if (!base?.id || !(base.ownerId || base.owner_id)) return;
    await platformDb.addEvent({
      type: added ? 'favorite_add' : 'favorite_remove',
      base_id: String(base.id),
      owner_id: base.ownerId || base.owner_id,
      user_id: userId || null,
    });
  },
};

function buildSeries(days, events, type) {
  const from = startOfDay(new Date(Date.now() - (days - 1) * 86400000));
  const map = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from.getTime() + i * 86400000);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ev of events) {
    if (type && ev.type !== type) continue;
    if (!inRange(ev.created_at, from)) continue;
    const key = dayKey(ev.created_at);
    if (map.has(key)) map.set(key, map.get(key) + 1);
  }
  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}

function uniqueSessions(events, type, from) {
  const set = new Set();
  for (const ev of events) {
    if (type && ev.type !== type) continue;
    if (!inRange(ev.created_at, from)) continue;
    set.add(ev.session_id || ev.id);
  }
  return set.size;
}

export const ownerDashboardService = {
  periods: PERIODS,

  async getDashboard(ownerId, periodId = '30d') {
    const period = PERIODS.find((p) => p.id === periodId) || PERIODS[1];
    const from = new Date(Date.now() - period.days * 86400000);

    const [bases, events, reviews] = await Promise.all([
      basesService.listMine(ownerId),
      platformDb.listEventsByOwner(ownerId),
      platformDb.listReviewsByOwner(ownerId),
    ]);

    const periodEvents = events.filter((e) => inRange(e.created_at, from));
    const periodReviews = reviews.filter((r) => inRange(r.created_at, from));

    const views = periodEvents.filter((e) => e.type === 'view').length;
    const uniqueViews = uniqueSessions(periodEvents, 'view', from);
    const clicks = periodEvents.filter((e) => e.type === 'click').length;
    const favorites = periodEvents.filter((e) => e.type === 'favorite_add').length;
    const ratingValues = reviews.map((r) => Number(r.rating)).filter((n) => n > 0);
    const ratingAvg = ratingValues.length
      ? Number((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(2))
      : 0;

    let subscription = await paymentService.getActiveSubscription(ownerId);
    let plan = null;
    if (subscription?.plan_id) {
      plan = await plansService.get(subscription.plan_id);
    }
    if (!subscription) {
      const legacy = localAuthStore.getSubscription(ownerId);
      if (legacy) {
        subscription = legacy;
        plan =
          (await plansService.getByCode(legacy.plan_code)) ||
          localAuthStore.plans.find((p) => p.code === legacy.plan_code) ||
          null;
        if (plan && plan.priceMonth != null && plan.price_month == null) {
          plan = { ...plan, name: plan.name, price_month: plan.priceMonth };
        }
      }
    }

    return {
      period,
      basesCount: bases.length,
      basesApproved: bases.filter((b) => b.status === 'approved').length,
      basesPending: bases.filter((b) => b.status === 'pending').length,
      views,
      uniqueViews,
      clicks,
      favorites,
      rating: ratingAvg,
      reviewsCount: reviews.length,
      reviewsPeriod: periodReviews.length,
      unansweredReviews: reviews.filter((r) => !r.owner_reply).length,
      subscription,
      plan: plan
        ? {
            name: plan.name,
            code: plan.code || plan.plan_code,
            priceMonth: plan.price_month ?? plan.priceMonth,
          }
        : null,
      charts: {
        views: buildSeries(Math.min(period.days, 90), events, 'view'),
        clicks: buildSeries(Math.min(period.days, 90), events, 'click'),
        favorites: buildSeries(Math.min(period.days, 90), events, 'favorite_add'),
        reviews: buildSeries(
          Math.min(period.days, 90),
          reviews.map((r) => ({ ...r, type: 'review', session_id: r.id })),
          'review'
        ),
      },
      byBase: bases.map((b) => {
        const be = periodEvents.filter((e) => String(e.base_id) === String(b.id));
        const br = reviews.filter((r) => String(r.base_id) === String(b.id));
        const ratings = br.map((r) => Number(r.rating)).filter((n) => n > 0);
        return {
          id: b.id,
          name: b.name,
          status: b.status,
          views: be.filter((e) => e.type === 'view').length,
          uniqueViews: uniqueSessions(be, 'view', from),
          clicks: be.filter((e) => e.type === 'click').length,
          favorites: be.filter((e) => e.type === 'favorite_add').length,
          reviews: br.length,
          rating: ratings.length
            ? Number((ratings.reduce((a, c) => a + c, 0) / ratings.length).toFixed(2))
            : 0,
        };
      }),
    };
  },

  async listReviews(ownerId) {
    const [reviews, bases] = await Promise.all([
      platformDb.listReviewsByOwner(ownerId),
      basesService.listMine(ownerId),
    ]);
    const names = Object.fromEntries(bases.map((b) => [String(b.id), b.name]));
    return reviews
      .map((r) => ({
        ...r,
        base_name: names[String(r.base_id)] || r.base_name || 'База',
      }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async replyToReview(ownerId, reviewId, text) {
    const review = await platformDb.getReview(reviewId);
    if (!review || review.owner_id !== ownerId) {
      throw new Error('Отзыв не найден или нет доступа');
    }
    if (!text?.trim()) throw new Error('Введите текст ответа');
    return platformDb.updateReview(reviewId, {
      owner_reply: text.trim(),
      owner_replied_at: new Date().toISOString(),
    });
  },

  sessionId: getAnalyticsSessionId,
};
