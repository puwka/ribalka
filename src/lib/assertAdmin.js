import { localAuthStore } from './localAuthStore';
import { supabase, supabaseDataEnabled } from './supabase';
import { authService } from '../services/authService';
import { ApiError } from './apiError';

/**
 * Admin gate aligned with AuthContext / RequireRole.
 * Supabase session first, then local demo admin fallback.
 */
export async function assertAdmin(adminId) {
  if (!adminId) throw new ApiError('Нет прав администратора', { status: 403 });

  if (supabaseDataEnabled && supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id === adminId) {
        const bundle = await authService.getSessionBundle();
        if (bundle?.isAdmin) {
          return { id: user.id, mode: 'supabase' };
        }
      }
    } catch {
      /* fall through to local admin */
    }
  }

  try {
    return localAuthStore.assertAdmin(adminId);
  } catch {
    throw new ApiError('Нет прав администратора', { status: 403 });
  }
}
