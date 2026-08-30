/**
 * Local auth + user-data store (localStorage).
 * Used when Supabase is not enabled so auth flows work in development.
 * Mirrors platform roles: user | owner | admin
 */

const STORE_KEY = 'rybalka_auth_store_v1';
const SESSION_KEY = 'rybalka_session_v1';

const ACHIEVEMENT_CATALOG = [
  { code: 'first_report', name: 'Первый отчёт', description: 'Опубликовали первый отчёт', points: 10 },
  { code: 'first_review', name: 'Первый отзыв', description: 'Оставили отзыв о базе', points: 5 },
  { code: 'first_booking', name: 'Первое бронирование', description: 'Забронировали отдых', points: 15 },
  { code: 'social_angler', name: 'Общительный рыболов', description: '10 комментариев', points: 20 },
  { code: 'map_explorer', name: 'Исследователь', description: '5 мест в избранном', points: 10 },
];

const PLANS = [
  {
    code: 'owner_basic',
    name: 'База — Старт',
    priceMonth: 990,
    features: ['1 база', 'Бронирования', 'Базовая статистика'],
  },
  {
    code: 'owner_pro',
    name: 'База — Про',
    priceMonth: 2490,
    features: ['Несколько баз', 'Приоритет в поиске', 'Расширенная аналитика'],
  },
];

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    users: [],
    profiles: {},
    favorites: {},
    notifications: {},
    notificationSettings: {},
    userAchievements: {},
    commentsCount: {},
    reportsMeta: {},
    ownerBases: {},
    ownerReviews: {},
    ownerStats: {},
    subscriptions: {},
    payments: {},
    ads: {},
  };
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function buildBundle(store, user) {
  if (!user) return null;
  const profile = store.profiles[user.id] || {
    user_id: user.id,
    display_name: user.email.split('@')[0],
    bio: '',
    phone: '',
    city: 'Пермь',
    avatar_path: null,
    is_public: true,
  };

  const roles = Array.from(new Set([user.primary_role, ...(user.roles || [])]));
  const achievements = store.userAchievements[user.id] || [];
  const ratingPoints = achievements.reduce((sum, a) => {
    const meta = ACHIEVEMENT_CATALOG.find((c) => c.code === a.code);
    return sum + (meta?.points || 0);
  }, 0);

  return {
    authUser: { id: user.id, email: user.email },
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      primary_role: user.primary_role,
      referral_code: user.referral_code,
      created_at: user.created_at,
    },
    profile: {
      user_id: user.id,
      display_name: profile.display_name,
      bio: profile.bio || '',
      phone: profile.phone || '',
      city: profile.city || 'Пермь',
      avatar_path: profile.avatar_path || null,
      is_public: profile.is_public !== false,
    },
    roles,
    isAdmin: roles.includes('admin'),
    isOwner: roles.includes('owner') || roles.includes('admin'),
    isUser: true,
    ratingPoints,
    achievements,
    notifications: store.notifications[user.id] || [],
    favorites: store.favorites[user.id] || [],
  };
}

function ensureSeed(store) {
  if (store.users.length > 0) return store;

  const createdAt = nowIso();
  const seeds = [
    {
      id: 'user_demo_user',
      email: 'user@demo.local',
      password_hash: null,
      primary_role: 'user',
      roles: ['user'],
      status: 'active',
      referral_code: 'userdemo01',
      created_at: createdAt,
      display_name: 'Иван Рыболов',
    },
    {
      id: 'user_demo_owner',
      email: 'owner@demo.local',
      password_hash: null,
      primary_role: 'owner',
      roles: ['user', 'owner'],
      status: 'active',
      referral_code: 'ownerdemo1',
      created_at: createdAt,
      display_name: 'Сергей Владелец',
    },
    {
      id: 'user_demo_admin',
      email: 'admin@demo.local',
      password_hash: null,
      primary_role: 'admin',
      roles: ['user', 'owner', 'admin'],
      status: 'active',
      referral_code: 'admindemo1',
      created_at: createdAt,
      display_name: 'Админ Платформы',
    },
  ];

  return { store, seeds, needsHash: true };
}

async function bootstrap() {
  let store = readStore();
  const seedInfo = ensureSeed(store);

  if (seedInfo.needsHash) {
    const demoHash = await sha256('demo1234');
    for (const s of seedInfo.seeds) {
      store.users.push({
        id: s.id,
        email: s.email,
        password_hash: demoHash,
        primary_role: s.primary_role,
        roles: s.roles,
        status: s.status,
        referral_code: s.referral_code,
        created_at: s.created_at,
      });
      store.profiles[s.id] = {
        user_id: s.id,
        display_name: s.display_name,
        bio: '',
        phone: '',
        city: 'Пермь',
        avatar_path: null,
        is_public: true,
      };
      store.favorites[s.id] = s.primary_role === 'user' ? [1, 2] : [];
      store.notifications[s.id] = [
        {
          id: uid('ntf'),
          type: 'system',
          title: 'Добро пожаловать!',
          body: 'Кабинет готов к работе.',
          is_read: false,
          created_at: nowIso(),
          link_path: '/cabinet',
        },
      ];
      store.userAchievements[s.id] =
        s.primary_role === 'user'
          ? [{ code: 'map_explorer', earned_at: nowIso() }]
          : [];
    }

    // Owner sample bases (ids align with static bases.js where possible)
    store.ownerBases['user_demo_owner'] = [
      {
        id: 'own_base_1',
        legacyId: 1,
        name: 'База "Чусовские зори"',
        type: 'paid',
        status: 'published',
        short_description: 'Рыбалка на Чусовой, домики, баня.',
        description: 'Уютная база на берегу реки Чусовой.',
        price_label: 'от 2500 ₽/сутки',
        fish_species: 'Щука, окунь, судак, лещ',
        address: 'Пермский край, Чусовской район',
        phone: '8-993-196-05-76',
        work_hours: 'Круглосуточно',
        services: ['Прокат лодок', 'Баня', 'Кафе'],
        updated_at: nowIso(),
      },
      {
        id: 'own_base_2',
        legacyId: 2,
        name: 'Платный пруд "Каравай"',
        type: 'paid',
        status: 'draft',
        short_description: 'Карп, форель, беседки.',
        description: 'Благоустроенный платный пруд.',
        price_label: '1500 ₽/день',
        fish_species: 'Карп, форель',
        address: 'Пермский край, Пермский район',
        phone: '8-993-196-05-76',
        work_hours: '08:00 - 22:00',
        services: ['Беседки', 'Мангалы'],
        updated_at: nowIso(),
      },
    ];

    store.ownerReviews['user_demo_owner'] = [
      {
        id: 'rev_1',
        base_id: 'own_base_1',
        base_name: 'База "Чусовские зори"',
        author_name: 'Алексей',
        body: 'Отличная база, всё понравилось!',
        rating: 5,
        status: 'approved',
        created_at: nowIso(),
        owner_reply: null,
        owner_replied_at: null,
      },
      {
        id: 'rev_2',
        base_id: 'own_base_1',
        base_name: 'База "Чусовские зори"',
        author_name: 'Мария',
        body: 'Домики уютные, но дорога разбита.',
        rating: 4,
        status: 'approved',
        created_at: nowIso(),
        owner_reply: null,
        owner_replied_at: null,
      },
    ];

    store.ownerStats['user_demo_owner'] = {
      viewsTotal: 1284,
      viewsWeek: 96,
      favorites: 47,
      bookingsPending: 3,
      reviewsAvg: 4.5,
    };

    store.subscriptions['user_demo_owner'] = {
      plan_code: 'owner_basic',
      status: 'active',
      current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString(),
    };

    store.payments['user_demo_owner'] = [
      {
        id: uid('pay'),
        amount: 990,
        currency: 'RUB',
        status: 'succeeded',
        provider: 'manual',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
        description: 'Продление тарифа «База — Старт»',
      },
    ];

    store.ads['user_demo_owner'] = [
      {
        id: uid('ad'),
        title: 'Акция: скидка 10% на будни',
        ad_type: 'banner',
        status: 'active',
        description: 'Реклама базы Чусовские зори',
        target_url: '/paid-waters',
        updated_at: nowIso(),
      },
    ];

    writeStore(store);
  }

  return store;
}

export const localAuthStore = {
  achievementCatalog: ACHIEVEMENT_CATALOG,
  plans: PLANS,

  async init() {
    await bootstrap();
  },

  async signUp({ email, password, displayName, role = 'user' }) {
    await bootstrap();
    const store = readStore();
    const normalized = String(email).trim().toLowerCase();
    if (store.users.some((u) => u.email === normalized)) {
      throw new Error('Пользователь с таким email уже зарегистрирован');
    }
    if (!password || password.length < 6) {
      throw new Error('Пароль должен быть не короче 6 символов');
    }

    const allowedRole = role === 'owner' ? 'owner' : 'user';
    const id = uid('user');
    const user = {
      id,
      email: normalized,
      password_hash: await sha256(password),
      primary_role: allowedRole,
      roles: allowedRole === 'owner' ? ['user', 'owner'] : ['user'],
      status: 'active',
      referral_code: uid('ref').slice(0, 12),
      created_at: nowIso(),
    };

    store.users.push(user);
    store.profiles[id] = {
      user_id: id,
      display_name: displayName?.trim() || normalized.split('@')[0],
      bio: '',
      phone: '',
      city: 'Пермь',
      avatar_path: null,
      is_public: true,
    };
    store.favorites[id] = [];
    store.notifications[id] = [
      {
        id: uid('ntf'),
        type: 'system',
        title: 'Регистрация успешна',
        body: 'Добро пожаловать на платформу «Рыбалка в Прикамье».',
        is_read: false,
        created_at: nowIso(),
        link_path: '/cabinet',
      },
    ];
    store.userAchievements[id] = [];
    if (allowedRole === 'owner') {
      store.ownerBases[id] = [];
      store.ownerReviews[id] = [];
      store.ownerStats[id] = {
        viewsTotal: 0,
        viewsWeek: 0,
        favorites: 0,
        bookingsPending: 0,
        reviewsAvg: 0,
      };
      store.subscriptions[id] = {
        plan_code: 'owner_basic',
        status: 'trialing',
        current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      };
      store.payments[id] = [];
      store.ads[id] = [];
    }

    writeStore(store);
    const session = { userId: id, createdAt: nowIso() };
    writeSession(session);
    return buildBundle(store, user);
  },

  async signIn(email, password) {
    await bootstrap();
    const store = readStore();
    const normalized = String(email).trim().toLowerCase();
    const user = store.users.find((u) => u.email === normalized);
    if (!user || user.status !== 'active') {
      throw new Error('Неверный email или пароль');
    }
    const hash = await sha256(password);
    if (hash !== user.password_hash) {
      throw new Error('Неверный email или пароль');
    }
    writeSession({ userId: user.id, createdAt: nowIso() });
    return buildBundle(store, user);
  },

  async signOut() {
    writeSession(null);
  },

  async getSessionBundle() {
    await bootstrap();
    const session = readSession();
    if (!session?.userId) return null;
    const store = readStore();
    const user = store.users.find((u) => u.id === session.userId);
    if (!user || user.status !== 'active') {
      writeSession(null);
      return null;
    }
    return buildBundle(store, user);
  },

  async updateProfile(userId, patch) {
    const store = readStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error('Пользователь не найден');
    const prev = store.profiles[userId] || {};
    store.profiles[userId] = {
      ...prev,
      display_name: patch.display_name?.trim() || prev.display_name,
      bio: patch.bio ?? prev.bio,
      phone: patch.phone ?? prev.phone,
      city: patch.city ?? prev.city,
      is_public: patch.is_public ?? prev.is_public,
    };
    writeStore(store);
    return buildBundle(store, user);
  },

  getFavorites(userId) {
    const store = readStore();
    return store.favorites[userId] || [];
  },

  toggleFavorite(userId, baseId) {
    const store = readStore();
    const list = new Set(store.favorites[userId] || []);
    const id = Number.isNaN(Number(baseId)) ? baseId : Number(baseId);
    if (list.has(id)) list.delete(id);
    else list.add(id);
    store.favorites[userId] = Array.from(list);
    writeStore(store);
    return store.favorites[userId];
  },

  getNotifications(userId) {
    return readStore().notifications[userId] || [];
  },

  pushNotification(userId, { type = 'system', title, body, link_path = null, payload = null }) {
    if (!userId) return null;
    const store = readStore();
    const item = {
      id: uid('ntf'),
      type,
      title,
      body,
      is_read: false,
      created_at: nowIso(),
      link_path,
      payload: payload || {},
    };
    store.notifications[userId] = [item, ...(store.notifications[userId] || [])].slice(0, 200);
    writeStore(store);
    return item;
  },

  removeNotification(userId, notificationId) {
    const store = readStore();
    store.notifications[userId] = (store.notifications[userId] || []).filter(
      (n) => n.id !== notificationId
    );
    writeStore(store);
    return store.notifications[userId];
  },

  clearReadNotifications(userId) {
    const store = readStore();
    store.notifications[userId] = (store.notifications[userId] || []).filter((n) => !n.is_read);
    writeStore(store);
    return store.notifications[userId];
  },

  getNotificationSettings(userId) {
    return readStore().notificationSettings[userId] || null;
  },

  setNotificationSettings(userId, settings) {
    const store = readStore();
    store.notificationSettings[userId] = settings;
    writeStore(store);
    return settings;
  },

  listUserIds() {
    return readStore().users.map((u) => u.id);
  },

  markNotificationRead(userId, notificationId) {
    const store = readStore();
    const list = store.notifications[userId] || [];
    store.notifications[userId] = list.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    writeStore(store);
    return store.notifications[userId];
  },

  markAllNotificationsRead(userId) {
    const store = readStore();
    store.notifications[userId] = (store.notifications[userId] || []).map((n) => ({
      ...n,
      is_read: true,
    }));
    writeStore(store);
    return store.notifications[userId];
  },

  getAchievements(userId) {
    const store = readStore();
    const earned = store.userAchievements[userId] || [];
    return ACHIEVEMENT_CATALOG.map((a) => ({
      ...a,
      earned: earned.some((e) => e.code === a.code),
      earned_at: earned.find((e) => e.code === a.code)?.earned_at || null,
    }));
  },

  /** OWNER: only own bases */
  getOwnerBases(ownerId) {
    const store = readStore();
    return store.ownerBases[ownerId] || [];
  },

  getOwnerBase(ownerId, baseId) {
    const bases = this.getOwnerBases(ownerId);
    const base = bases.find((b) => b.id === baseId);
    if (!base) throw new Error('База не найдена или нет доступа');
    return base;
  },

  updateOwnerBase(ownerId, baseId, patch) {
    const store = readStore();
    const bases = store.ownerBases[ownerId] || [];
    const idx = bases.findIndex((b) => b.id === baseId);
    if (idx === -1) throw new Error('База не найдена или нет доступа');
    bases[idx] = { ...bases[idx], ...patch, updated_at: nowIso() };
    store.ownerBases[ownerId] = bases;
    writeStore(store);
    return bases[idx];
  },

  getOwnerStats(ownerId) {
    return (
      readStore().ownerStats[ownerId] || {
        viewsTotal: 0,
        viewsWeek: 0,
        favorites: 0,
        bookingsPending: 0,
        reviewsAvg: 0,
      }
    );
  },

  getOwnerReviews(ownerId) {
    return readStore().ownerReviews[ownerId] || [];
  },

  replyToReview(ownerId, reviewId, replyText) {
    const store = readStore();
    const list = store.ownerReviews[ownerId] || [];
    const idx = list.findIndex((r) => r.id === reviewId);
    if (idx === -1) throw new Error('Отзыв не найден или нет доступа');
    list[idx] = {
      ...list[idx],
      owner_reply: replyText.trim(),
      owner_replied_at: nowIso(),
    };
    store.ownerReviews[ownerId] = list;
    writeStore(store);
    return list[idx];
  },

  getSubscription(ownerId) {
    return readStore().subscriptions[ownerId] || null;
  },

  renewSubscription(ownerId, planCode = 'owner_basic') {
    const store = readStore();
    const plan = PLANS.find((p) => p.code === planCode) || PLANS[0];
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    store.subscriptions[ownerId] = {
      plan_code: plan.code,
      status: 'active',
      current_period_end: end,
    };
    const payment = {
      id: uid('pay'),
      amount: plan.priceMonth,
      currency: 'RUB',
      status: 'succeeded',
      provider: 'manual',
      created_at: nowIso(),
      description: `Продление тарифа «${plan.name}»`,
    };
    store.payments[ownerId] = [payment, ...(store.payments[ownerId] || [])];
    store.notifications[ownerId] = [
      {
        id: uid('ntf'),
        type: 'subscription',
        title: 'Тариф продлён',
        body: `Подписка «${plan.name}» активна до ${new Date(end).toLocaleDateString('ru-RU')}`,
        is_read: false,
        created_at: nowIso(),
        link_path: '/owner/plan',
      },
      ...(store.notifications[ownerId] || []),
    ];
    writeStore(store);
    return { subscription: store.subscriptions[ownerId], payment };
  },

  getPayments(ownerId) {
    return readStore().payments[ownerId] || [];
  },

  getAds(ownerId) {
    return readStore().ads[ownerId] || [];
  },

  upsertAd(ownerId, ad) {
    const store = readStore();
    const list = store.ads[ownerId] || [];
    if (ad.id) {
      const idx = list.findIndex((a) => a.id === ad.id);
      if (idx === -1) throw new Error('Объявление не найдено');
      list[idx] = { ...list[idx], ...ad, updated_at: nowIso() };
    } else {
      list.unshift({
        id: uid('ad'),
        title: ad.title,
        ad_type: ad.ad_type || 'banner',
        status: ad.status || 'draft',
        description: ad.description || '',
        target_url: ad.target_url || '',
        updated_at: nowIso(),
      });
    }
    store.ads[ownerId] = list;
    writeStore(store);
    return store.ads[ownerId];
  },

  /** Admin: list users without passwords */
  listUsersForAdmin() {
    const store = readStore();
    return store.users.map((u) => ({
      id: u.id,
      email: u.email,
      primary_role: u.primary_role,
      roles: u.roles,
      status: u.status,
      created_at: u.created_at,
      display_name: store.profiles[u.id]?.display_name,
    }));
  },

  assertAdmin(adminId) {
    const store = readStore();
    const admin = store.users.find((u) => u.id === adminId);
    if (!admin?.roles?.includes('admin') && admin?.primary_role !== 'admin') {
      throw new Error('Недостаточно прав');
    }
    return admin;
  },

  getPublicProfile(userId) {
    const store = readStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user || user.status === 'blocked') return null;
    const profile = store.profiles[userId];
    if (profile && profile.is_public === false) {
      return {
        user_id: userId,
        display_name: profile.display_name || 'Рыболов',
        bio: '',
        city: '',
        is_public: false,
        primary_role: user.primary_role,
        created_at: user.created_at,
      };
    }
    return {
      user_id: userId,
      display_name: profile?.display_name || user.email.split('@')[0],
      bio: profile?.bio || '',
      city: profile?.city || '',
      phone: profile?.is_public !== false ? profile?.phone || '' : '',
      is_public: profile?.is_public !== false,
      primary_role: user.primary_role,
      created_at: user.created_at,
    };
  },

  setUserStatus(adminId, targetUserId, status) {
    const store = readStore();
    const admin = store.users.find((u) => u.id === adminId);
    if (!admin?.roles?.includes('admin') && admin?.primary_role !== 'admin') {
      throw new Error('Недостаточно прав');
    }
    const user = store.users.find((u) => u.id === targetUserId);
    if (!user) throw new Error('Пользователь не найден');
    user.status = status;
    writeStore(store);
    return user;
  },
};
