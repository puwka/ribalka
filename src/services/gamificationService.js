import { engagementDb } from '../lib/engagementDb';
import { localAuthStore } from '../lib/localAuthStore';

/**
 * Dynamic achievement catalog. Progress is computed from live stats.
 */
export const ACHIEVEMENTS = [
  {
    code: 'first_report',
    name: 'Первый отчёт',
    description: 'Опубликовали первый отчёт о рыбалке',
    badge: '🎣',
    points: 20,
    category: 'reports',
    goal: 1,
    stat: 'reports_count',
  },
  {
    code: 'reports_5',
    name: '5 отчётов',
    description: 'Опубликовали 5 отчётов',
    badge: '📓',
    points: 50,
    category: 'reports',
    goal: 5,
    stat: 'reports_count',
  },
  {
    code: 'places_10',
    name: '10 мест посещено',
    description: 'Открыли карточки 10 разных баз или мест',
    badge: '🗺️',
    points: 40,
    category: 'explore',
    goal: 10,
    stat: 'places_visited_count',
  },
  {
    code: 'first_comment',
    name: 'Первый комментарий',
    description: 'Оставили первый комментарий к отчёту',
    badge: '💬',
    points: 10,
    category: 'social',
    goal: 1,
    stat: 'comments_count',
  },
  {
    code: 'comments_10',
    name: '10 комментариев',
    description: 'Оставили 10 комментариев',
    badge: '🗣️',
    points: 35,
    category: 'social',
    goal: 10,
    stat: 'comments_count',
  },
  {
    code: 'likes_100',
    name: '100 лайков',
    description: 'Получили 100 лайков на свои отчёты',
    badge: '❤️',
    points: 100,
    category: 'social',
    goal: 100,
    stat: 'likes_received',
  },
  {
    code: 'first_favorite',
    name: 'Коллекционер',
    description: 'Добавили первый объект в избранное',
    badge: '⭐',
    points: 5,
    category: 'favorites',
    goal: 1,
    stat: 'favorites_added',
  },
  {
    code: 'favorites_10',
    name: 'Подборка профи',
    description: '10 объектов в избранном (когда-либо добавлено)',
    badge: '🏆',
    points: 25,
    category: 'favorites',
    goal: 10,
    stat: 'favorites_added',
  },
];

function notifyUnlock(userId, achievement) {
  try {
    const store = JSON.parse(localStorage.getItem('rybalka_auth_store_v1') || '{}');
    if (!store.notifications) store.notifications = {};
    const list = store.notifications[userId] || [];
    list.unshift({
      id: `ntf_${crypto.randomUUID()}`,
      type: 'achievement',
      title: `Достижение: ${achievement.name}`,
      body: `${achievement.badge} ${achievement.description} (+${achievement.points} очков)`,
      is_read: false,
      created_at: new Date().toISOString(),
      link_path: '/cabinet/achievements',
    });
    store.notifications[userId] = list.slice(0, 50);
    localStorage.setItem('rybalka_auth_store_v1', JSON.stringify(store));
  } catch {
    // ignore
  }
}

function normalizeStats(stats) {
  const places = Array.isArray(stats.places_visited) ? stats.places_visited : [];
  return {
    ...stats,
    places_visited: places,
    places_visited_count: places.length,
  };
}

async function evaluateUnlocks(userId, stats) {
  const normalized = normalizeStats(stats);
  const unlocked = [];
  for (const ach of ACHIEVEMENTS) {
    const value = Number(normalized[ach.stat] || 0);
    if (value >= ach.goal) {
      const row = await engagementDb.unlockAchievement(userId, ach.code);
      if (row) {
        unlocked.push(ach);
        notifyUnlock(userId, ach);
      }
    }
  }
  return unlocked;
}

export const gamificationService = {
  catalog: ACHIEVEMENTS,

  async getProgress(userId) {
    const [statsRaw, earned] = await Promise.all([
      engagementDb.getStats(userId),
      engagementDb.listAchievements(userId),
    ]);
    const stats = normalizeStats(statsRaw);
    const earnedMap = Object.fromEntries(earned.map((e) => [e.code, e]));

    const items = ACHIEVEMENTS.map((ach) => {
      const current = Math.min(Number(stats[ach.stat] || 0), ach.goal);
      const unlocked = Boolean(earnedMap[ach.code]);
      return {
        ...ach,
        current,
        progress: Math.round((current / ach.goal) * 100),
        unlocked,
        earned_at: earnedMap[ach.code]?.earned_at || null,
      };
    });

    const ratingPoints = items
      .filter((i) => i.unlocked)
      .reduce((sum, i) => sum + i.points, 0);

    const unlockedCount = items.filter((i) => i.unlocked).length;

    return {
      stats,
      items,
      ratingPoints,
      unlockedCount,
      totalCount: ACHIEVEMENTS.length,
      badges: items.filter((i) => i.unlocked).map((i) => ({
        code: i.code,
        name: i.name,
        badge: i.badge,
        earned_at: i.earned_at,
      })),
    };
  },

  async getLeaderboard(limit = 20) {
    const [allStats, allAch] = await Promise.all([
      engagementDb.listAllStats(),
      engagementDb.listAllAchievements(),
    ]);

    const pointsByUser = {};
    for (const a of allAch) {
      const meta = ACHIEVEMENTS.find((c) => c.code === a.code);
      pointsByUser[a.user_id] = (pointsByUser[a.user_id] || 0) + (meta?.points || 0);
    }

    let profiles = {};
    try {
      profiles = Object.fromEntries(
        (localAuthStore.listUsersForAdmin?.() || []).map((u) => [
          u.id,
          u.display_name || u.email,
        ])
      );
    } catch {
      profiles = {};
    }

    const rows = Object.keys({
      ...Object.fromEntries(allStats.map((s) => [s.user_id, true])),
      ...pointsByUser,
    }).map((userId) => {
      const stats = normalizeStats(
        allStats.find((s) => s.user_id === userId) || { user_id: userId, places_visited: [] }
      );
      return {
        user_id: userId,
        name: profiles[userId] || `Рыболов ${userId.slice(-4)}`,
        points: pointsByUser[userId] || 0,
        reports: stats.reports_count || 0,
        likes: stats.likes_received || 0,
        places: stats.places_visited_count || 0,
      };
    });

    return rows.sort((a, b) => b.points - a.points || b.likes - a.likes).slice(0, limit);
  },

  async onPlaceVisited(userId, placeId) {
    if (!userId || !placeId) return [];
    const stats = await engagementDb.getStats(userId);
    const set = new Set(stats.places_visited || []);
    set.add(String(placeId));
    stats.places_visited = Array.from(set);
    await engagementDb.saveStats(stats);
    return evaluateUnlocks(userId, stats);
  },

  async onReportCreated(userId) {
    if (!userId) return [];
    const stats = await engagementDb.getStats(userId);
    stats.reports_count = (stats.reports_count || 0) + 1;
    await engagementDb.saveStats(stats);
    return evaluateUnlocks(userId, stats);
  },

  async onCommentCreated(userId) {
    if (!userId) return [];
    const stats = await engagementDb.getStats(userId);
    stats.comments_count = (stats.comments_count || 0) + 1;
    await engagementDb.saveStats(stats);
    return evaluateUnlocks(userId, stats);
  },

  async onLikeReceived(authorUserId) {
    if (!authorUserId) return [];
    const stats = await engagementDb.getStats(authorUserId);
    stats.likes_received = (stats.likes_received || 0) + 1;
    await engagementDb.saveStats(stats);
    return evaluateUnlocks(authorUserId, stats);
  },

  async onLikeGiven(userId) {
    if (!userId) return [];
    const stats = await engagementDb.getStats(userId);
    stats.likes_given = (stats.likes_given || 0) + 1;
    await engagementDb.saveStats(stats);
    return evaluateUnlocks(userId, stats);
  },

  async onFavoriteAdded(userId) {
    if (!userId) return [];
    const stats = await engagementDb.getStats(userId);
    stats.favorites_added = (stats.favorites_added || 0) + 1;
    await engagementDb.saveStats(stats);
    return evaluateUnlocks(userId, stats);
  },

  async syncFromFavorites(userId) {
    // counters for "added" stay monotonic; only re-evaluate
    const stats = await engagementDb.getStats(userId);
    return evaluateUnlocks(userId, stats);
  },

  async recompute(userId) {
    const stats = await engagementDb.getStats(userId);
    return evaluateUnlocks(userId, stats);
  },
};
