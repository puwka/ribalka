/**
 * Platform architecture overview (foundation stage).
 *
 * Roles: USER | OWNER | ADMIN  (table roles + users.primary_role + user_roles)
 *
 * Mapping from current frontend:
 * - src/data/bases.js          → bases + base_images + base_videos + base_services
 * - BaseModal localStorage     → base_reviews
 * - useReports localStorage    → fishing_reports + report_* + comments + report_votes
 * - src/data/news.js           → news
 * - src/data/calendarData.js   → calendar_data
 * - DirectoryPage hardcoded    → advertising (ad_type = directory)
 * - AdminPage sessionStorage   → auth.users + users + RLS (admin role)
 * - fishing_user_id            → auth.uid() / users.id
 *
 * Enable remote data: set VITE_USE_SUPABASE=true and valid VITE_SUPABASE_* in .env.local
 * Until then hooks keep serving static / localStorage data.
 */

export const PLATFORM_ROLES = Object.freeze({
  USER: 'user',
  OWNER: 'owner',
  ADMIN: 'admin',
});

export const STORAGE_BUCKETS = Object.freeze({
  avatars: 'avatars',
  baseImages: 'base-images',
  baseVideos: 'base-videos',
  reportImages: 'report-images',
  reportVideos: 'report-videos',
  newsImages: 'news-images',
  advertising: 'advertising',
  achievements: 'achievements',
});
