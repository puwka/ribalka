/** Secret-ish SPA path for admin UI (not /admin). API stays under /api/*. */
export const ADMIN_BASE = '/liderus';

export function adminPath(sub = '') {
  const clean = String(sub || '').replace(/^\/+/, '');
  return clean ? `${ADMIN_BASE}/${clean}` : ADMIN_BASE;
}

export function isAdminUiPath(pathname = '') {
  const p = String(pathname || '');
  return p === ADMIN_BASE || p.startsWith(`${ADMIN_BASE}/`);
}
