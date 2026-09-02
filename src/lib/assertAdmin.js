import { localAuthStore } from './localAuthStore';
import { apiDataEnabled } from './apiClient';
import { authService } from '../services/authService';
import { ApiError } from './apiError';

/**
 * Admin gate aligned with AuthContext / RequireRole.
 * API session first, then local demo admin fallback.
 */
export async function assertAdmin(adminId) {
  if (!adminId) throw new ApiError('Нет прав администратора', { status: 403 });

  if (apiDataEnabled && authService.mode() === 'api') {
    try {
      const bundle = await authService.getSessionBundle();
      if (bundle?.user?.id === adminId && bundle?.isAdmin) {
        return { id: adminId, mode: 'api' };
      }
    } catch {
      /* fall through */
    }
  }

  try {
    return localAuthStore.assertAdmin(adminId);
  } catch {
    throw new ApiError('Нет прав администратора', { status: 403 });
  }
}
