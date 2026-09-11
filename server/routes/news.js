import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

async function ensureNewsAuthorColumn() {
  try {
    await pool.query(`
      alter table public.news
        add column if not exists author_name text
    `);
  } catch {
    /* ignore */
  }
}

function mapNews(row) {
  if (!row) return null;
  return {
    ...row,
    id: String(row.id),
    cover_url: row.cover_url || null,
    author: row.author_name || 'Редакция',
    author_name: row.author_name || 'Редакция',
    date: (row.published_at || row.created_at || '').toString().slice(0, 10),
    views: row.views_count ?? row.views ?? 0,
    image: row.cover_url || null,
  };
}

router.get('/', async (_req, res, next) => {
  try {
    await ensureNewsAuthorColumn();
    const { rows } = await pool.query(
      `select * from public.news
       where status = 'published'
       order by published_at desc nulls last, created_at desc`
    );
    res.json(rows.map(mapNews));
  } catch (err) {
    next(err);
  }
});

router.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await ensureNewsAuthorColumn();
    const status = req.query.status || 'all';
    const { rows } = await pool.query(
      status === 'all'
        ? `select * from public.news order by updated_at desc nulls last, created_at desc`
        : `select * from public.news where status = $1 order by updated_at desc nulls last, created_at desc`,
      status === 'all' ? [] : [status]
    );
    res.json(rows.map(mapNews));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await ensureNewsAuthorColumn();
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim() || title;
    if (!title) return res.status(400).json({ error: 'Укажите заголовок' });

    const status = body.status || 'draft';
    const slug =
      String(body.slug || '').trim() ||
      title.toLowerCase().replace(/\s+/g, '-').slice(0, 80);
    const publishedAt =
      status === 'published'
        ? body.published_at || new Date().toISOString()
        : body.published_at || null;

    const { rows } = await pool.query(
      `insert into public.news (
         title, slug, excerpt, content, cover_url, cover_path, category,
         status, published_at, author_id, author_name
       ) values ($1,$2,$3,$4,$5,$6,$7,$8::public.content_status,$9,$10,$11)
       returning *`,
      [
        title,
        slug,
        String(body.excerpt || '').trim() || null,
        content,
        body.cover_url || body.image || null,
        body.cover_path || null,
        String(body.category || 'Новости').trim(),
        status,
        publishedAt,
        req.user.sub,
        String(body.author || body.author_name || '').trim() || 'Редакция',
      ]
    );
    res.status(201).json(mapNews(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await ensureNewsAuthorColumn();
    const body = req.body || {};
    const { rows: found } = await pool.query(`select * from public.news where id = $1`, [
      req.params.id,
    ]);
    const existing = found[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const title =
      body.title != null ? String(body.title).trim() : existing.title;
    if (!title) return res.status(400).json({ error: 'Укажите заголовок' });

    const status = body.status != null ? body.status : existing.status;
    const content =
      body.content != null
        ? String(body.content).trim() || title
        : existing.content;
    const publishedAt =
      status === 'published'
        ? body.published_at || existing.published_at || new Date().toISOString()
        : body.published_at !== undefined
          ? body.published_at
          : existing.published_at;

    const { rows } = await pool.query(
      `update public.news set
         title = $2,
         slug = $3,
         excerpt = $4,
         content = $5,
         cover_url = $6,
         cover_path = $7,
         category = $8,
         status = $9::public.content_status,
         published_at = $10,
         author_name = $11,
         updated_at = now()
       where id = $1
       returning *`,
      [
        existing.id,
        title,
        body.slug != null
          ? String(body.slug).trim() || existing.slug
          : existing.slug,
        body.excerpt != null ? String(body.excerpt).trim() : existing.excerpt,
        content,
        body.cover_url != null || body.image != null
          ? body.cover_url || body.image
          : existing.cover_url,
        body.cover_path != null ? body.cover_path : existing.cover_path,
        body.category != null
          ? String(body.category).trim()
          : existing.category,
        status,
        publishedAt,
        body.author != null || body.author_name != null
          ? String(body.author || body.author_name || '').trim() || 'Редакция'
          : existing.author_name || 'Редакция',
      ]
    );
    res.json(mapNews(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`delete from public.news where id = $1`, [
      req.params.id,
    ]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, deleted: true });
  } catch (err) {
    next(err);
  }
});

/** Public: increment view counter */
router.post('/:id/view', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `update public.news set
         views_count = coalesce(views_count, 0) + 1,
         updated_at = now()
       where id = $1 and status = 'published'
       returning *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(mapNews(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`select * from public.news where id = $1`, [
      req.params.id,
    ]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    const isAdmin = (req.user?.roles || []).includes('admin');
    if (row.status !== 'published' && row.status !== 'approved' && !isAdmin) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(mapNews(row));
  } catch (err) {
    next(err);
  }
});

export default router;
