import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './AuthShared.css';

function AuthLoading() {
  return (
    <div className="auth-loading" role="status">
      <div className="auth-loading__spinner" />
      <p>Загрузка сессии…</p>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/**
 * @param {{ roles: Array<'user'|'owner'|'admin'>, children: import('react').ReactNode, fallback?: string }} props
 */
export function RequireRole({ roles, children, fallback }) {
  const { loading, isAuthenticated, hasRole, isAdmin, isOwner } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const allowed = isAdmin || roles.some((r) => hasRole(r));
  if (!allowed) {
    const dest = fallback || (isOwner ? '/owner' : '/cabinet');
    return <Navigate to={dest} replace state={{ denied: true, from: location.pathname }} />;
  }

  return children;
}

export function GuestOnly({ children }) {
  const { isAuthenticated, loading, isAdmin, isOwner } = useAuth();
  if (loading) return <AuthLoading />;
  if (isAuthenticated) {
    if (isAdmin) return <Navigate to="/admin" replace />;
    if (isOwner) return <Navigate to="/owner" replace />;
    return <Navigate to="/cabinet" replace />;
  }
  return children;
}
