import { cmsDb } from '../lib/cmsDb';
import { api, apiDataEnabled } from '../lib/apiClient';
import { mapNewsToUi } from '../lib/mappers';
import { assertAdmin } from '../lib/assertAdmin';
import { newsData } from '../data/news';
import { auditService } from './auditService';

function isSeedNewsId(id) {
  return id != null && /^\d+$/.test(String(id));
}

function toUi(row) {
  if (!row) return null;
  const mapped = mapNewsToUi({
    ...row,
    cover_url: row.cover_url || row.image || null,
    author_name: row.author_name || row.author,
  });
  return {
    ...mapped,
    status: row.status || mapped.status || 'published',
    author: row.author || mapped.author,
    slug: row.slug || String(row.id),
    cover_url: row.cover_url || mapped.image || '',
    image: row.cover_url || row.image || mapped.image || '',
  };
}

function fromForm(form, existing) {
  return {
    id: existing?.id || crypto.randomUUID(),
    title: form.title.trim(),
    slug: form.slug?.trim() || form.title.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 80),
    excerpt: form.excerpt?.trim() || '',
    content: form.content?.trim() || '',
    cover_path: form.cover_path || null,
    cover_url: form.cover_url || form.image || null,
    image: form.cover_url || form.image || null,
    category: form.category?.trim() || 'Новости',
    author: form.author?.trim() || existing?.author || 'Редакция',
    status: form.status || 'draft',
    published_at:
      form.status === 'published'
        ? form.published_at || existing?.published_at || new Date().toISOString()
        : form.published_at || null,
    views_count: existing?.views_count ?? existing?.views ?? 0,
    date: (form.published_at || existing?.published_at || new Date().toISOString()).slice(0, 10),
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function seedNewsItems() {
  return newsData.map((n) => ({
    ...n,
    status: n.status || 'published',
    slug: String(n.id),
  }));
}

function sortNews(items) {
  return [...items].sort((a, b) =>
    String(b.date || b.published_at || '').localeCompare(String(a.date || a.published_at || ''))
  );
}

export const newsAdminService = {
  emptyForm() {
    return {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      cover_url: '',
      category: 'Новости',
      author: '',
      status: 'draft',
      published_at: '',
    };
  },

  async listPublic() {
    // Production / API mode: только Postgres, без сида и IndexedDB
    if (apiDataEnabled) {
      const rows = await api.get('/api/news');
      return sortNews((rows || []).map(toUi).filter(Boolean));
    }

    const local = await cmsDb.listNews('published');
    const byId = new Map();
    for (const item of seedNewsItems()) byId.set(String(item.id), toUi(item));
    for (const item of local) byId.set(String(item.id), toUi(item));
    return sortNews(
      Array.from(byId.values()).filter((n) => (n.status || 'published') === 'published')
    );
  },

  async listAdmin(adminId, status = 'all') {
    await assertAdmin(adminId);

    if (apiDataEnabled) {
      const qs = status === 'all' ? 'all' : status;
      const rows = await api.get(`/api/news/admin?status=${encodeURIComponent(qs)}`);
      return sortNews((rows || []).map(toUi).filter(Boolean));
    }

    const local = await cmsDb.listNews();
    const byId = new Map();
    for (const item of seedNewsItems()) byId.set(String(item.id), toUi(item));
    for (const item of local) byId.set(String(item.id), toUi(item));
    let items = Array.from(byId.values());
    if (status !== 'all') {
      items = items.filter((n) => (n.status || 'published') === status);
    }
    return sortNews(items);
  },

  async getById(id) {
    const key = String(id);

    if (apiDataEnabled && !isSeedNewsId(key)) {
      try {
        const row = await api.get(`/api/news/${encodeURIComponent(key)}`);
        return toUi(row);
      } catch {
        /* fall through for local/seed */
      }
    }

    const local = await cmsDb.getNews(key);
    const seed = newsData.find((n) => String(n.id) === key);
    if (local) return toUi(seed ? { ...seed, ...local } : local);
    if (seed) return toUi({ ...seed, status: 'published' });
    return null;
  },

  async save(adminId, form, existingId, adminName) {
    await assertAdmin(adminId);
    const existing = existingId ? await this.getById(existingId) : null;
    const record = fromForm(form, existing);

    if (apiDataEnabled) {
      const payload = {
        title: record.title,
        slug: record.slug,
        excerpt: record.excerpt,
        content: record.content || record.title,
        cover_url: record.cover_url,
        cover_path: record.cover_path,
        category: record.category,
        status: record.status,
        published_at: record.published_at,
        author: record.author,
      };
      const saved = existingId
        ? await api.patch(`/api/news/${encodeURIComponent(existingId)}`, payload)
        : await api.post('/api/news', payload);

      await auditService.log({
        adminId,
        adminName,
        action: existingId ? 'update' : 'create',
        entity: 'news',
        entityId: saved.id,
        summary: `${existingId ? 'Обновлена' : 'Создана'} новость «${record.title}»`,
      });
      return toUi(saved);
    }

    record.id = existingId ? String(existingId) : String(record.id);
    await cmsDb.putNews(record);
    await auditService.log({
      adminId,
      adminName,
      action: existingId ? 'update' : 'create',
      entity: 'news',
      entityId: record.id,
      summary: `${existingId ? 'Обновлена' : 'Создана'} новость «${record.title}»`,
    });
    return toUi(record);
  },

  async setStatus(adminId, id, status, adminName) {
    await assertAdmin(adminId);
    const existing = await this.getById(id);
    if (!existing) throw new Error('Новость не найдена');

    if (apiDataEnabled) {
      const saved = await api.patch(`/api/news/${encodeURIComponent(id)}`, {
        status,
        published_at:
          status === 'published'
            ? existing.published_at || new Date().toISOString()
            : existing.published_at,
      });
      await auditService.log({
        adminId,
        adminName,
        action: status,
        entity: 'news',
        entityId: id,
        summary: `Новость «${existing.title}» → ${status}`,
      });
      return toUi(saved);
    }

    const patch = {
      ...existing,
      status,
      published_at:
        status === 'published'
          ? existing.published_at || new Date().toISOString()
          : existing.published_at,
      updated_at: new Date().toISOString(),
    };
    await cmsDb.putNews(patch);
    await auditService.log({
      adminId,
      adminName,
      action: status,
      entity: 'news',
      entityId: id,
      summary: `Новость «${existing.title}» → ${status}`,
    });
    return toUi(patch);
  },

  async archive(adminId, id, adminName) {
    return this.setStatus(adminId, id, 'archived', adminName);
  },

  async remove(adminId, id, adminName) {
    await assertAdmin(adminId);
    const existing = await this.getById(id);
    if (!existing) throw new Error('Новость не найдена');

    if (apiDataEnabled) {
      if (isSeedNewsId(id)) {
        throw new Error('Сидовые новости нельзя удалить через API — они больше не показываются в проде');
      }
      await api.delete(`/api/news/${encodeURIComponent(id)}`);
    } else {
      await cmsDb.deleteNews(id);
    }

    await auditService.log({
      adminId,
      adminName,
      action: 'delete',
      entity: 'news',
      entityId: id,
      summary: `Удалена новость «${existing.title}»`,
    });
  },
};
