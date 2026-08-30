import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';
import { localAuthStore } from '../lib/localAuthStore';

function isRemoteAuth() {
  return supabaseDataEnabled && Boolean(supabase);
}

async function remoteBundle() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const appUser = unwrap(
    await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
  );
  const profile = unwrap(
    await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
  );
  const rolesRows = unwrap(
    await supabase
      .from('user_roles')
      .select('roles ( code, name )')
      .eq('user_id', user.id)
  );

  let notifications = [];
  try {
    notifications = unwrap(
      await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
    ) || [];
  } catch {
    notifications = [];
  }

  const roles = Array.from(
    new Set([
      appUser?.primary_role,
      ...(rolesRows ?? []).map((r) => r.roles?.code).filter(Boolean),
    ].filter(Boolean))
  );

  return {
    authUser: user,
    user: appUser,
    profile,
    roles,
    isAdmin: roles.includes('admin'),
    isOwner: roles.includes('owner') || roles.includes('admin'),
    isUser: true,
    ratingPoints: 0,
    achievements: [],
    notifications,
    favorites: [],
  };
}

/**
 * Unified auth facade: Supabase when enabled, otherwise local store.
 */
export const authService = {
  mode: () => (isRemoteAuth() ? 'supabase' : 'local'),

  async init() {
    if (!isRemoteAuth()) await localAuthStore.init();
  },

  async getSessionBundle() {
    if (isRemoteAuth()) {
      const session = await this.getSession();
      if (!session) return null;
      return remoteBundle();
    }
    return localAuthStore.getSessionBundle();
  },

  async getSession() {
    if (!isRemoteAuth()) {
      const bundle = await localAuthStore.getSessionBundle();
      return bundle ? { user: bundle.authUser } : null;
    }
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async signIn(email, password) {
    if (isRemoteAuth()) {
      unwrap(await supabase.auth.signInWithPassword({ email, password }));
      return remoteBundle();
    }
    return localAuthStore.signIn(email, password);
  },

  async signUp(email, password, displayName, role = 'user') {
    const safeRole = role === 'owner' ? 'owner' : 'user';
    if (isRemoteAuth()) {
      unwrap(
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              requested_role: safeRole,
            },
          },
        })
      );
      return remoteBundle();
    }
    return localAuthStore.signUp({ email, password, displayName, role: safeRole });
  },

  async signOut() {
    if (isRemoteAuth()) {
      await supabase.auth.signOut();
      return;
    }
    await localAuthStore.signOut();
  },

  async updateProfile(userId, patch) {
    if (isRemoteAuth()) {
      unwrap(
        await supabase
          .from('profiles')
          .update({
            display_name: patch.display_name,
            bio: patch.bio,
            phone: patch.phone,
            city: patch.city,
            is_public: patch.is_public,
          })
          .eq('user_id', userId)
      );
      return remoteBundle();
    }
    return localAuthStore.updateProfile(userId, patch);
  },

  async getCurrentUserBundle() {
    return this.getSessionBundle();
  },
};

export { localAuthStore };
