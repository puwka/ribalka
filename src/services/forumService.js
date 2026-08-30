import { socialDb, CONTENT_STATUS } from '../lib/socialDb';
import { ApiError } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';
import { localAuthStore } from '../lib/localAuthStore';

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
      // show pending only to author — filter later in UI if needed
      messages = messages.filter(
        (m) => m.status === CONTENT_STATUS.APPROVED || (viewerKey && m.authorId && viewerKey === String(m.authorId))
      );
    }
    messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    return {
      topic: publicTopic(topic, viewerKey),
      messages: messages.map((m) => publicMessage(m, viewerKey)),
    };
  },

  async listByAuthor(authorId, { viewerKey = null } = {}) {
    const topics = (await socialDb.listTopics()).filter(
      (t) => t.authorId === authorId && t.status === CONTENT_STATUS.APPROVED
    );
    return topics.map((t) => publicTopic(t, viewerKey));
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

  async addMessage({
    topicId,
    authorId,
    authorName,
    body,
    parentId = null,
    kind = 'message', // message | reply | comment
  }) {
    if (!authorId) throw new ApiError('Войдите, чтобы ответить');
    if (!body?.trim()) throw new ApiError('Введите текст');

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
      status: CONTENT_STATUS.APPROVED,
      createdAt: now,
      updatedAt: now,
      moderationNote: null,
    };
    await socialDb.putMessage(message);

    topic.repliesCount = (topic.repliesCount || 0) + 1;
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
    return topic;
  },

  async moderateMessage(adminId, messageId, { action, note = '' }) {
    await assertAdmin(adminId);
    const msg = await socialDb.getMessage(messageId);
    if (!msg) throw new ApiError('Сообщение не найдено');
    if (action === 'approve') msg.status = CONTENT_STATUS.APPROVED;
    else if (action === 'reject') msg.status = CONTENT_STATUS.REJECTED;
    else if (action === 'hide') msg.status = CONTENT_STATUS.HIDDEN;
    else throw new ApiError('Неизвестное действие');
    msg.moderationNote = note || null;
    await socialDb.putMessage(msg);
    return msg;
  },

  async listForModeration(status = 'pending') {
    const topics = await socialDb.listTopics();
    const messages = await socialDb.listAllMessages();
    const t = (status === 'all' ? topics : topics.filter((x) => x.status === status)).map((x) => ({
      ...x,
      _type: 'topic',
    }));
    const m = (status === 'all' ? messages : messages.filter((x) => x.status === status)).map((x) => ({
      ...x,
      _type: 'message',
    }));
    return [...t, ...m].sort((a, b) =>
      String(b.createdAt || b.updatedAt).localeCompare(String(a.createdAt || a.updatedAt))
    );
  },
};
