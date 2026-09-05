import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

/** Client UI uses approved; DB content_status uses published */
function toClientStatus(dbStatus) {
  if (dbStatus === 'published') return 'approved';
  return dbStatus;
}

function toDbStatus(clientStatus) {
  if (clientStatus === 'approved') return 'published';
  return clientStatus;
}

function mapTopic(row, authorName) {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    authorId: row.author_id,
    authorName: authorName || 'Рыболов',
    baseId: null,
    baseName: null,
    placeLabel: '',
    status: toClientStatus(row.status),
    pinned: row.is_pinned,
    locked: row.is_locked,
    likedBy: [],
    repliesCount: row.replies_count || 0,
    lastMessageAt: row.last_message_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row, authorName) {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    body: row.body,
    authorId: row.author_id,
    authorName: authorName || 'Рыболов',
    status: row.status === 'published' ? 'approved' : row.status,
    likedBy: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function authorNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { rows } = await pool.query(
    `select u.id, coalesce(p.display_name, u.email) as name
     from public.users u
     left join public.profiles p on p.user_id = u.id
     where u.id = any($1::uuid[])`,
    [unique]
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

router.use(authMiddleware);

router.get('/topics', async (req, res, next) => {
  try {
    const status = req.query.status || 'approved';
    const dbStatus = status === 'all' ? null : toDbStatus(status);
    const { rows } = await pool.query(
      dbStatus
        ? `select * from public.forum_topics where status = $1::public.content_status
           order by is_pinned desc, coalesce(last_message_at, created_at) desc`
        : `select * from public.forum_topics
           order by is_pinned desc, coalesce(last_message_at, created_at) desc`,
      dbStatus ? [dbStatus] : []
    );
    const names = await authorNames(rows.map((r) => r.author_id));
    res.json(rows.map((r) => mapTopic(r, names[r.author_id])));
  } catch (err) {
    next(err);
  }
});

router.get('/topics/moderation', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const dbStatus = status === 'all' ? null : toDbStatus(status);
    const { rows } = await pool.query(
      dbStatus
        ? `select * from public.forum_topics where status = $1::public.content_status order by created_at desc`
        : `select * from public.forum_topics order by created_at desc`,
      dbStatus ? [dbStatus] : []
    );
    const names = await authorNames(rows.map((r) => r.author_id));
    res.json(rows.map((r) => mapTopic(r, names[r.author_id])));
  } catch (err) {
    next(err);
  }
});

router.get('/topics/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`select * from public.forum_topics where id = $1`, [
      req.params.id,
    ]);
    const topic = rows[0];
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const isAdmin = (req.user?.roles || []).includes('admin');
    const isAuthor = req.user?.sub === topic.author_id;
    if (!isAdmin && topic.status !== 'published' && !isAuthor) {
      return res.status(404).json({ error: 'Тема недоступна' });
    }

    const msgRes = await pool.query(
      `select * from public.forum_messages where topic_id = $1 order by created_at`,
      [topic.id]
    );
    const names = await authorNames([topic.author_id, ...msgRes.rows.map((m) => m.author_id)]);
    let messages = msgRes.rows;
    if (!isAdmin) {
      messages = messages.filter(
        (m) =>
          m.status === 'approved' || (isAuthor && m.author_id === req.user?.sub)
      );
    }
    res.json({
      topic: mapTopic(topic, names[topic.author_id]),
      messages: messages.map((m) => mapMessage(m, names[m.author_id])),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/topics', requireAuth, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!title) return res.status(400).json({ error: 'Укажите заголовок' });
    if (!body) return res.status(400).json({ error: 'Напишите текст темы' });

    const { rows } = await pool.query(
      `insert into public.forum_topics (author_id, title, body, status, last_message_at)
       values ($1, $2, $3, 'pending', now())
       returning *`,
      [req.user.sub, title, body]
    );
    const names = await authorNames([req.user.sub]);
    res.status(201).json(mapTopic(rows[0], names[req.user.sub]));
  } catch (err) {
    next(err);
  }
});

router.patch('/topics/:id/moderate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = toDbStatus(req.body?.status);
    if (!['pending', 'published', 'rejected', 'archived', 'draft'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await pool.query(
      `update public.forum_topics set status = $2::public.content_status, updated_at = now()
       where id = $1 returning *`,
      [req.params.id, status]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const names = await authorNames([rows[0].author_id]);
    res.json(mapTopic(rows[0], names[rows[0].author_id]));
  } catch (err) {
    next(err);
  }
});

router.post('/topics/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Пустое сообщение' });
    const { rows: topics } = await pool.query(`select * from public.forum_topics where id = $1`, [
      req.params.id,
    ]);
    if (!topics[0] || topics[0].is_locked) {
      return res.status(400).json({ error: 'Тема недоступна для ответов' });
    }
    const { rows } = await pool.query(
      `insert into public.forum_messages (topic_id, author_id, body, status)
       values ($1, $2, $3, 'approved')
       returning *`,
      [req.params.id, req.user.sub, body]
    );
    await pool.query(
      `update public.forum_topics set
         replies_count = replies_count + 1,
         last_message_at = now(),
         updated_at = now()
       where id = $1`,
      [req.params.id]
    );
    const names = await authorNames([req.user.sub]);
    res.status(201).json(mapMessage(rows[0], names[req.user.sub]));
  } catch (err) {
    next(err);
  }
});

export default router;
