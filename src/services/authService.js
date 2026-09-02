import { api, apiDataEnabled, getToken, setToken } from '../lib/apiClient';
import { localAuthStore } from '../lib/localAuthStore';

function isRemoteAuth() {
  return apiDataEnabled;
}

function mapBundle(data) {
  if (!data?.user) return null;
  return {
    authUser: { id: data.user.id, email: data.user.email },
    user: data.user,
    profile: data.profile,
    roles: data.roles || [],
    isAdmin: Boolean(data.isAdmin),
    isOwner: Boolean(data.isOwner),
    isUser: true,
    ratingPoints: 0,
    achievements: [],
    notifications: data.notifications || [],
    favorites: [],
    token: data.token,
  };
}

/**
 * Unified auth: self-hosted API when enabled, otherwise local store.
 */
export const authService = {
  mode: () => (isRemoteAuth() ? 'api' : 'local'),

  async init() {
    if (!isRemoteAuth()) await localAuthStore.init();
  },

  async getSessionBundle() {
    if (isRemoteAuth()) {
      if (!getToken()) return null;
      try {
        const data = await api.get('/api/auth/me');
        return mapBundle(data);
      } catch {
        setToken(null);
        return null;
      }
    }
    return localAuthStore.getSessionBundle();
  },

  async getSession() {
    if (!isRemoteAuth()) {
      const bundle = await localAuthStore.getSessionBundle();
      return bundle ? { user: bundle.authUser } : null;
    }
    if (!getToken()) return null;
    return { access_token: getToken() };
  },

  async signIn(email, password) {
    if (isRemoteAuth()) {
      const data = await api.post('/api/auth/login', { email, password });
      setToken(data.token);
      return mapBundle(data);
    }
    return localAuthStore.signIn(email, password);
  },

  async signUp(email, password, displayName, role = 'user') {
    const safeRole = role === 'owner' ? 'owner' : 'user';
    if (isRemoteAuth()) {
      const data = await api.post('/api/auth/register', {
        email,
        password,
        displayName,
        role: safeRole,
      });
      setToken(data.token);
      return mapBundle(data);
    }
    return localAuthStore.signUp({ email, password, displayName, role: safeRole });
  },

  async signOut() {
    if (isRemoteAuth()) {
      setToken(null);
      return;
    }
    await localAuthStore.signOut();
  },

  async updateProfile(userId, patch) {
    if (isRemoteAuth()) {
      const data = await api.patch('/api/auth/profile', patch);
      return mapBundle({ ...data, user: data.user, token: getToken() });
    }
    return localAuthStore.updateProfile(userId, patch);
  },

  async getCurrentUserBundle() {
    return this.getSessionBundle();
  },
};

export { localAuthStore };
