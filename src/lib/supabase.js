/**
 * Supabase browser client.
 * Uses only public anon key — never service_role in the frontend.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  url &&
  anonKey &&
  !String(url).includes('YOUR_PROJECT_REF') &&
  !String(anonKey).includes('YOUR_SUPABASE_ANON_KEY')
);

/** True when app should use Supabase Postgres/Auth (not a React Hook). */
export const supabaseDataEnabled =
  import.meta.env.VITE_USE_SUPABASE === 'true' && isSupabaseConfigured;

/** @deprecated use supabaseDataEnabled */
export const useSupabaseData = supabaseDataEnabled;

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
