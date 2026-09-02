/**
 * @deprecated Supabase removed. Use apiClient.js (self-hosted PostgreSQL + REST API).
 */
export {
  apiDataEnabled,
  apiDataEnabled as supabaseDataEnabled,
  apiBaseUrl,
} from './apiClient';

/** Always null — direct DB client removed from browser */
export const supabase = null;

import { apiDataEnabled } from './apiClient';
export const useSupabaseData = apiDataEnabled;
