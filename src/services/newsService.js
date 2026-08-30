import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap, resolveMediaUrl } from '../lib/apiError';
import { mapNewsToUi } from '../lib/mappers';

export const newsService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  async list() {
    if (!this.isEnabled()) return null;

    const rows = unwrap(
      await supabase
        .from('news')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
    );

    return (rows ?? []).map((row) =>
      mapNewsToUi({
        ...row,
        cover_url:
          row.cover_url ||
          resolveMediaUrl(supabase, 'news-images', row.cover_path, null),
      })
    );
  },

  async getById(id) {
    if (!this.isEnabled()) return null;

    const row = unwrap(
      await supabase.from('news').select('*').eq('id', id).maybeSingle()
    );

    if (!row) return null;

    return mapNewsToUi({
      ...row,
      cover_url:
        row.cover_url ||
        resolveMediaUrl(supabase, 'news-images', row.cover_path, null),
    });
  },
};
