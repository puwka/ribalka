import { cmsDb } from '../lib/cmsDb';
import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap, resolveMediaUrl } from '../lib/apiError';
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
    cover_url:
      row.cover_url ||
      row.image ||
      resolveMediaUrl(supabase, 'news-images', row.cover_path, null),
    author_name: row.author_name || row.author,
  });
  return {
    ...mapped,
    status: row.status || mapped.status || 'published',
    author: row.author || mapped.author,
    slug: row.slug || String(row.id),
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

function mergeNewsLists(seedItems, remoteItems, localItems) {
  const byId = new Map();

  for (const item of seedItems) {
    byId.set(String(item.id), toUi(item));
  }

  for (const item of remoteItems) {
    byId.set(String(item.id), toUi(item));
  }

  for (const item of localItems) {
    const key = String(item.id);
    const prev = byId.get(key);
    byId.set(key, toUi(prev ? { ...prev, ...item } : item));
  }

  return Array.from(byId.values());
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
    let remote = [];
    if (supabaseDataEnabled && supabase) {
      try {
        const result = await supabase
          .from('news')
          .select('*')
          .eq('status', 'published')
          .order('published_at', { ascending: false });
        remote = unwrap(result) || [];
      } catch {
        remote = [];
      }
    }

    const local = await cmsDb.listNews('published');
    const merged = mergeNewsLists(seedNewsItems(), remote, local);
    return sortNews(merged.filter((n) => (n.status || 'published') === 'published'));
  },

  async listAdmin(adminId, status = 'all') {
    await assertAdmin(adminId);

    let remote = [];
    if (supabaseDataEnabled && supabase) {
      try {
        let query = supabase.from('news').select('*').order('updated_at', { ascending: false });
        if (status !== 'all') query = query.eq('status', status);
        remote = unwrap(await query) || [];
      } catch {
        remote = [];
      }
    }

    const local = await cmsDb.listNews();
    let items = mergeNewsLists(seedNewsItems(), remote, local);

    if (status !== 'all') {
      items = items.filter((n) => (n.status || 'published') === status);
    }

    return sortNews(items);
  },

  async getById(id) {
    const key = String(id);
    const local = await cmsDb.getNews(key);

    if (supabaseDataEnabled && supabase && !isSeedNewsId(key)) {
      try {
        const row = unwrap(await supabase.from('news').select('*').eq('id', id).maybeSingle());
        if (row) return toUi(local ? { ...row, ...local } : row);
      } catch {
        /* fall through */
      }
    }

    const seed = newsData.find((n) => String(n.id) === key);
    if (local) return toUi(seed ? { ...seed, ...local } : local);
    if (seed) return toUi({ ...seed, status: 'published' });
    return null;
  },

  async save(adminId, form, existingId, adminName) {
    await assertAdmin(adminId);
    const existing = existingId ? await this.getById(existingId) : null;
    const record = fromForm(form, existing);
    const key = existingId ? String(existingId) : null;
    const useSupabase = supabaseDataEnabled && supabase && !isSeedNewsId(key);

    if (useSupabase) {
      const payload = {
        title: record.title,
        slug: record.slug,
        excerpt: record.excerpt,
        content: record.content,
        cover_path: record.cover_path,
        cover_url: record.cover_url,
        category: record.category,
        status: record.status,
        published_at: record.published_at,
        author_id: adminId,
      };

      if (key) {
        unwrap(await supabase.from('news').update(payload).eq('id', key));
        record.id = key;
      } else {
        const inserted = unwrap(
          await supabase.from('news').insert(payload).select('*').single()
        );
        record.id = inserted.id;
      }
    } else {
      record.id = key || String(record.id);
      await cmsDb.putNews(record);
    }

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

    const patch = {
      ...existing,
      status,
      published_at:
        status === 'published'
          ? existing.published_at || new Date().toISOString()
          : existing.published_at,
      updated_at: new Date().toISOString(),
    };

    if (supabaseDataEnabled && supabase && !isSeedNewsId(id)) {
      unwrap(
        await supabase
          .from('news')
          .update({ status, published_at: patch.published_at })
          .eq('id', id)
      );
    } else {
      await cmsDb.putNews(patch);
    }

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

    if (supabaseDataEnabled && supabase && !isSeedNewsId(id)) {
      unwrap(await supabase.from('news').update({ status: 'archived' }).eq('id', id));
    } else {
      await cmsDb.deleteNews(id);
    }

    await auditService.log({
      adminId,
      adminName,
      action: 'delete',
      entity: 'news',
      entityId: id,
      summary: `Удалена/архивирована новость «${existing.title}»`,
    });
  },
};
