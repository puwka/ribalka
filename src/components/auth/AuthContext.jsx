import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService } from '../../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      await authService.init();
      const next = await authService.getSessionBundle();
      setBundle(next);
      setError(null);
      return next;
    } catch (err) {
      setBundle(null);
      setError(err.message || 'Ошибка сессии');
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await authService.init();
        const next = await authService.getSessionBundle();
        if (alive) setBundle(next);
      } catch (err) {
        if (alive) {
          setBundle(null);
          setError(err.message);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    const next = await authService.signIn(email, password);
    setBundle(next);
    return next;
  }, []);

  const register = useCallback(async (email, password, displayName, role = 'user') => {
    setError(null);
    const next = await authService.signUp(email, password, displayName, role);
    setBundle(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await authService.signOut();
    setBundle(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    if (!bundle?.user?.id) throw new Error('Нужна авторизация');
    const next = await authService.updateProfile(bundle.user.id, patch);
    setBundle(next);
    return next;
  }, [bundle]);

  const hasRole = useCallback(
    (role) => Boolean(bundle?.roles?.includes(role)),
    [bundle]
  );

  const value = useMemo(
    () => ({
      loading,
      error,
      setError,
      bundle,
      user: bundle?.user ?? null,
      profile: bundle?.profile ?? null,
      roles: bundle?.roles ?? [],
      isAuthenticated: Boolean(bundle?.user),
      isAdmin: Boolean(bundle?.isAdmin),
      isOwner: Boolean(bundle?.isOwner),
      ratingPoints: bundle?.ratingPoints ?? 0,
      notifications: bundle?.notifications ?? [],
      favorites: bundle?.favorites ?? [],
      hasRole,
      login,
      register,
      logout,
      updateProfile,
      refresh,
      authMode: authService.mode(),
    }),
    [
      loading,
      error,
      bundle,
      hasRole,
      login,
      register,
      logout,
      updateProfile,
      refresh,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
