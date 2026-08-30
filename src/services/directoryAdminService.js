import { cmsService, CMS_PAGES } from './cmsService';
import { assertAdmin } from '../lib/assertAdmin';
import { DIRECTORY_CATEGORIES } from '../data/directorySeed';

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `dir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const directoryAdminService = {
  categories: DIRECTORY_CATEGORIES,

  emptyForm() {
    return {
      name: '',
      category: 'shop',
      description: '',
      address: '',
      phone: '',
      website: '',
      hours: '',
      image: '',
      tags: '',
      status: 'published',
    };
  },

  async getPage() {
    return cmsService.getPage(CMS_PAGES.DIRECTORY);
  },

  async listPublic() {
    const page = await this.getPage();
    const items = Array.isArray(page.items) ? page.items : [];
    return items.filter((i) => (i.status || 'published') === 'published');
  },

  async listAdmin(adminId, filter = 'all') {
    await assertAdmin(adminId);
    const page = await this.getPage();
    const items = Array.isArray(page.items) ? page.items : [];
    if (filter === 'all') return items;
    if (filter === 'shop' || filter === 'service' || filter === 'guide') {
      return items.filter((i) => i.category === filter);
    }
    return items.filter((i) => (i.status || 'published') === filter);
  },

  async saveMeta(adminId, { title, description }) {
    await assertAdmin(adminId);
    const page = await this.getPage();
    return cmsService.savePage(adminId, CMS_PAGES.DIRECTORY, {
      ...page,
      title: title ?? page.title,
      description: description ?? page.description,
      items: page.items || [],
    });
  },

  async saveItem(adminId, form, existingId = null) {
    await assertAdmin(adminId);
    const page = await this.getPage();
    const items = Array.isArray(page.items) ? [...page.items] : [];
    const tags = Array.isArray(form.tags)
      ? form.tags
      : String(form.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

    const row = {
      id: existingId || newId(),
      name: (form.name || '').trim(),
      category: form.category || 'shop',
      description: form.description || '',
      address: form.address || '',
      phone: form.phone || '',
      website: form.website || '',
      hours: form.hours || '',
      image: form.image || '',
      tags,
      status: form.status || 'published',
    };

    if (!row.name) throw new Error('Укажите название');

    const idx = items.findIndex((i) => String(i.id) === String(row.id));
    if (idx >= 0) items[idx] = row;
    else items.unshift(row);

    await cmsService.savePage(adminId, CMS_PAGES.DIRECTORY, {
      ...page,
      items,
    });
    return row;
  },

  async removeItem(adminId, id) {
    await assertAdmin(adminId);
    const page = await this.getPage();
    const items = (page.items || []).filter((i) => String(i.id) !== String(id));
    await cmsService.savePage(adminId, CMS_PAGES.DIRECTORY, {
      ...page,
      items,
    });
  },
};
