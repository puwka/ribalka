import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';

/**
 * Media uploads to Storage buckets.
 * Prefer Storage over base64 in localStorage (current ReportsPage pattern).
 */
export const mediaService = {
  isEnabled: () => supabaseDataEnabled && Boolean(supabase),

  /**
   * @param {'avatars'|'base-images'|'base-videos'|'report-images'|'report-videos'|'news-images'|'advertising'} bucket
   * @param {File|Blob} file
   * @param {string} [folder] usually auth user id
   */
  async upload(bucket, file, folder) {
    if (!this.isEnabled()) throw new Error('Supabase is not enabled');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Auth required');

    const safeFolder = folder || user.id;
    const ext = (file.name?.split('.').pop() || 'bin').toLowerCase();
    const path = `${safeFolder}/${crypto.randomUUID()}.${ext}`;

    unwrap(
      await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
    );

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: data?.publicUrl ?? null };
  },
};
