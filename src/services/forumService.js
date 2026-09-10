import { socialDb, CONTENT_STATUS } from '../lib/socialDb';
import { ApiError } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';
import { localAuthStore } from '../lib/localAuthStore';
import { api, apiDataEnabled } from '../lib/apiClient';

function voterKey(userId, anonId) {
  return userId ? String(userId) : anonId ? `anon:${anonId}` : null;
}

function publicTopic(topic, viewerKey) {
  if (!topic) return null;
  const likedBy = Array.isArray(topic.likedBy) ? topic.likedBy : [];
  return {
    ...topic,
    likes: likedBy.length,
    hasLiked: viewerKey ? likedBy.includes(viewerKey) : false,
  };
}

function publicMessage(msg, viewerKey) {
  if (!msg) return null;
  const likedBy = Array.isArray(msg.likedBy) ? msg.likedBy : [];
  return {
    ...msg,
    likes: likedBy.length,
    hasLiked: viewerKey ? likedBy.includes(viewerKey) : false,
  };
}

export const forumService = {
  statuses: CONTENT_STATUS,

  async listTopics({ status = 'approved', viewerKey = null, includeAll = false } = {}) {
    if (apiDataEnabled) {
      const qs = includeAll || status === 'all' ? 'all' : status;
      const rows = await api.get(`/api/forum/topics?status=${encodeURIComponent(qs)}`);
      return (rows || []).map((t) => publicTopic(t, viewerKey));
    }
    let rows = await socialDb.listTopics();
    if (!includeAll) rows = rows.filter((t) => t.status === status);
    else if (status !== 'all') rows = rows.filter((t) => t.status === status);

    return rows
      .map((t) => publicTopic(t, viewerKey))
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return String(b.lastMessageAt || b.createdAt).localeCompare(
          String(a.lastMessageAt || a.createdAt)
        );
      });
  },

  async getTopic(id, { viewerKey = null, isAdmin = false } = {}) {
    if (apiDataEnabled) {
      const data = await api.get(`/api/forum/topics/${encodeURIComponent(id)}`);
      return {
        topic: publicTopic(data.topic, viewerKey),
        messages: (data.messages || []).map((m) => publicMessage(m, viewerKey)),
      };
    }
    const topic = await socialDb.getTopic(id);
    if (!topic) throw new ApiError('Тема не найдена', { status: 404 });
    if (!isAdmin && topic.status !== CONTENT_STATUS.APPROVED && topic.status !== 'locked') {
      throw new ApiError('Тема недоступна', { status: 404 });
    }

    let messages = await socialDb.listMessagesByTopic(id);
    if (!isAdmin) {
      messages = messages.filter(
        (m) => m.status === CONTENT_STATUS.APPROVED || m.status === CONTENT_STATUS.PENDING
      );
      messages = messages.filter(
        (m) =>
          m.status === CONTENT_STATUS.APPROVED ||
          (viewerKey && m.authorId && viewerKey === String(m.authorId))
      );
    }
    messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    return {
      topic: publicTopic(topic, viewerKey),
      messages: messages.map((m) => publicMessage(m, viewerKey)),
    };
  },

  async listByAuthor(authorId, { viewerKey = null } = {}) {
    const topics = await this.listTopics({ status: 'all', includeAll: true, viewerKey });
    return topics.filter((t) => t.authorId === authorId);
  },

  async createTopic({
    title,
    body,
    authorId,
    authorName,
    baseId = null,
    baseName = null,
    placeLabel = '',
  }) {
    if (!authorId) throw new ApiError('Войдите, чтобы создать тему');
    if (!title?.trim()) throw new ApiError('Укажите заголовок');
    if (!body?.trim()) throw new ApiError('Напишите текст темы');

    if (apiDataEnabled) {
      const topic = await api.post('/api/forum/topics', {
        title,
        body,
        baseId,
        baseName,
        placeLabel,
      });
      return publicTopic(topic, authorId);
    }

    const now = new Date().toISOString();
    const topic = {
      id: crypto.randomUUID(),
      title: title.trim(),
      body: body.trim(),
      authorId,
      authorName: authorName?.trim() || 'Рыболов',
      baseId: baseId ? String(baseId) : null,
      baseName: baseName || null,
      placeLabel: (placeLabel || baseName || '').trim(),
      status: CONTENT_STATUS.PENDING,
      pinned: false,
      locked: false,
      likedBy: [],
      repliesCount: 0,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      moderationNote: null,
      moderatedAt: null,
    };
    await socialDb.putTopic(topic);

    localAuthStore.pushNotification(authorId, {
      type: 'forum',
      title: 'Тема отправлена на модерацию',
      body: topic.title,
      link_path: '/forum',
    });

    return publicTopic(topic, authorId);
  },

  async updateTopic(id, { title, body }, { authorId = null, isAdmin = false } = {}) {
    if (!title?.trim()) throw new ApiError('Укажите заголовок');
    if (!body?.trim()) throw new ApiError('Напишите текст темы');

    if (apiDataEnabled) {
      const topic = await api.patch(`/api/forum/topics/${encodeURIComponent(id)}`, {
        title: title.trim(),
        body: body.trim(),
      });
      return publicTopic(topic, authorId);
    }

    const topic = await socialDb.getTopic(id);
    if (!topic) throw new ApiError('Тема не найдена');
    const isAuthor = authorId && topic.authorId === authorId;
    if (!isAdmin && !isAuthor) throw new ApiError('Недостаточно прав');

    topic.title = title.trim();
    topic.body = body.trim();
    topic.updatedAt = new Date().toISOString();
    if (!isAdmin) {
      topic.status = CONTENT_STATUS.PENDING;
      topic.moderationNote = null;
      topic.moderatedAt = null;
    }
    await socialDb.putTopic(topic);
    return publicTopic(topic, authorId);
  },

  async addMessage({ topicId, authorId, authorName, body, parentId = null, kind = 'message' }) {
    if (!authorId) throw new ApiError('Войдите, чтобы ответить');
    if (!body?.trim()) throw new ApiError('Введите текст');

    if (apiDataEnabled) {
      return publicMessage(
        await api.post(`/api/forum/topics/${encodeURIComponent(topicId)}/messages`, {
          body,
          parentId,
          kind,
        }),
        authorId
      );
    }

    const topic = await socialDb.getTopic(topicId);
    if (!topic) throw new ApiError('Тема не найдена');
    if (topic.locked || topic.status === 'locked') {
      throw new ApiError('Тема закрыта для новых сообщений');
    }
    if (topic.status !== CONTENT_STATUS.APPROVED && topic.status !== 'locked') {
      throw new ApiError('Тема ещё не одобрена');
    }

    const now = new Date().toISOString();
    const message = {
      id: crypto.randomUUID(),
      topicId: String(topicId),
      authorId,
      authorName: authorName?.trim() || 'Рыболов',
      body: body.trim(),
      parentId: parentId != null ? String(parentId) : null,
      kind: kind === 'comment' ? 'comment' : parentId ? 'reply' : 'message',
      likedBy: [],
      status: CONTENT_STATUS.PENDING,
      createdAt: now,
      updatedAt: now,
      moderationNote: null,
    };
    await socialDb.putMessage(message);

    if (message.status === CONTENT_STATUS.APPROVED) {
      topic.repliesCount = (topic.repliesCount || 0) + 1;
    }
    topic.lastMessageAt = now;
    await socialDb.putTopic(topic);

    if (topic.authorId && topic.authorId !== authorId) {
      localAuthStore.pushNotification(topic.authorId, {
        type: 'forum',
        title: 'Новый ответ в теме',
        body: topic.title,
        link_path: `/forum/${topic.id}`,
      });
    }

    return publicMessage(message, authorId);
  },

  async likeTopic(topicId, { userId = null, anonId = null }) {
    if (apiDataEnabled) return { success: false, topic: null };
    const key = voterKey(userId, anonId);
    if (!key) throw new ApiError('Не удалось определить пользователя');
    const topic = await socialDb.getTopic(topicId);
    if (!topic || topic.status !== CONTENT_STATUS.APPROVED) throw new ApiError('Тема не найдена');
    const likedBy = Array.isArray(topic.likedBy) ? [...topic.likedBy] : [];
    if (likedBy.includes(key)) {
      return { success: false, topic: publicTopic(topic, key) };
    }
    likedBy.push(key);
    topic.likedBy = likedBy;
    await socialDb.putTopic(topic);
    return { success: true, topic: publicTopic(topic, key) };
  },

  async likeMessage(messageId, { userId = null, anonId = null }) {
    if (apiDataEnabled) return { success: false, message: null };
    const key = voterKey(userId, anonId);
    if (!key) throw new ApiError('Не удалось определить пользователя');
    const msg = await socialDb.getMessage(messageId);
    if (!msg || msg.status === CONTENT_STATUS.REJECTED || msg.status === CONTENT_STATUS.HIDDEN) {
      throw new ApiError('Сообщение не найдено');
    }
    const likedBy = Array.isArray(msg.likedBy) ? [...msg.likedBy] : [];
    if (likedBy.includes(key)) {
      return { success: false, message: publicMessage(msg, key) };
    }
    likedBy.push(key);
    msg.likedBy = likedBy;
    await socialDb.putMessage(msg);
    return { success: true, message: publicMessage(msg, key) };
  },

  async moderateTopic(adminId, topicId, { action, note = '' }) {
    await assertAdmin(adminId);

    if (apiDataEnabled) {
      const statusMap = {
        approve: 'approved',
        reject: 'rejected',
        hide: 'rejected',
        pending: 'pending',
      };
      if (!statusMap[action] && !['lock', 'unlock', 'pin', 'unpin'].includes(action)) {
        throw new ApiError('Неизвестное действие');
      }
      const payload = { note };
      if (statusMap[action]) payload.status = statusMap[action];
      if (['lock', 'unlock', 'pin', 'unpin'].includes(action)) payload.action = action;
      return publicTopic(
        await api.patch(`/api/forum/topics/${encodeURIComponent(topicId)}/moderate`, payload),
        null
      );
    }

    const topic = await socialDb.getTopic(topicId);
    if (!topic) throw new ApiError('Тема не найдена');

    if (action === 'approve') {
      topic.status = CONTENT_STATUS.APPROVED;
      topic.locked = false;
    } else if (action === 'reject') topic.status = CONTENT_STATUS.REJECTED;
    else if (action === 'hide') topic.status = CONTENT_STATUS.HIDDEN;
    else if (action === 'lock') {
      topic.locked = true;
      topic.status = CONTENT_STATUS.APPROVED;
    } else if (action === 'unlock') {
      topic.locked = false;
    } else if (action === 'pin') topic.pinned = true;
    else if (action === 'unpin') topic.pinned = false;
    else if (action === 'pending') topic.status = CONTENT_STATUS.PENDING;
    else throw new ApiError('Неизвестное действие');

    topic.moderationNote = note || null;
    topic.moderatedAt = new Date().toISOString();
    await socialDb.putTopic(topic);

    if (topic.authorId) {
      localAuthStore.pushNotification(topic.authorId, {
        type: 'moderation',
        title: `Форум: ${action}`,
        body: note || topic.title,
        link_path: '/forum',
      });
    }
    return publicTopic(topic, null);
  },

  async listPendingMessages(status = 'pending') {
    if (apiDataEnabled) {
      const rows = await api.get(
        `/api/forum/messages/moderation?status=${encodeURIComponent(status || 'pending')}`
      );
      return (rows || []).map((m) => ({ ...publicMessage(m, null), _type: 'message' }));
    }
    let rows = await socialDb.listAllMessages();
    if (status !== 'all') rows = rows.filter((m) => m.status === status);
    const topics = await socialDb.listTopics();
    const topicById = Object.fromEntries(topics.map((t) => [String(t.id), t]));
    return rows.map((m) => ({
      ...publicMessage(m, null),
      _type: 'message',
      topicTitle: topicById[String(m.topicId)]?.title || '',
    }));
  },

  async listForModeration(status = 'pending') {
    if (apiDataEnabled) {
      const rows = await api.get(
        `/api/forum/topics/moderation?status=${encodeURIComponent(status || 'pending')}`
      );
      return (rows || []).map((t) => ({ ...publicTopic(t, null), _type: 'topic' }));
    }
    let rows = await socialDb.listTopics();
    if (status !== 'all') rows = rows.filter((t) => t.status === status);
    return rows.map((t) => ({ ...publicTopic(t, null), _type: 'topic' }));
  },

  async moderateMessage(adminId, messageId, { action }) {
    await assertAdmin(adminId);
    if (apiDataEnabled) {
      const statusMap = { approve: 'approved', reject: 'rejected', hide: 'hidden' };
      const status = statusMap[action];
      if (!status) throw new ApiError('Неизвестное действие');
      return publicMessage(
        await api.patch(`/api/forum/messages/${encodeURIComponent(messageId)}/moderate`, {
          status,
        }),
        null
      );
    }
    const msg = await socialDb.getMessage(messageId);
    if (!msg) throw new ApiError('Сообщение не найдено');
    if (action === 'approve') {
      msg.status = CONTENT_STATUS.APPROVED;
      const topic = await socialDb.getTopic(msg.topicId);
      if (topic) {
        const all = await socialDb.listMessagesByTopic(msg.topicId);
        topic.repliesCount = all.filter((x) => x.status === CONTENT_STATUS.APPROVED).length;
        topic.lastMessageAt = new Date().toISOString();
        await socialDb.putTopic(topic);
      }
    } else if (action === 'reject' || action === 'hide') msg.status = CONTENT_STATUS.HIDDEN;
    else throw new ApiError('Неизвестное действие');
    await socialDb.putMessage(msg);
    return publicMessage(msg, null);
  },
};
